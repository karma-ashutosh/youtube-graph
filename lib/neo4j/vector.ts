import neo4j from 'neo4j-driver';
import { getSession } from './client';
import { generateEmbedding } from '../ai/embeddings';
import { getCurrentWorkspace } from '../workspace-context';

export interface SimilarConcept {
  concept_id: string;
  canonical_name: string;
  aliases: string[];
  category: string;
  total_mentions: number;
  similarity: number;
}

export interface SimilarSegment {
  segment_id: string;
  topic_hint: string;
  start_time: string;
  end_time: string;
  transcript: string;
  similarity: number;
  video_url: string;
  video_title?: string;
  concepts: Array<{
    name: string;
    id: string;
    role: string;
  }>;
}

/**
 * Initialize vector indexes (shared across all workspaces)
 * Workspace isolation is achieved through property filtering, not separate indices
 * Note: Neo4j only allows one vector index per node label + property combination
 */
export async function createVectorIndexes(): Promise<void> {
  const session = getSession();

  try {
    // Create concept embeddings index (shared across workspaces)
    await session.run(`
      CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
      FOR (c:Concept)
      ON c.embedding
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: 768,
        \`vector.similarity_function\`: 'cosine'
      }}
    `).catch((err) => {
      if (!err.message.includes('already exists') && !err.message.includes('equivalent index')) {
        throw err;
      }
      console.log('Concept vector index already exists');
    });

    // Create segment embeddings index (shared across workspaces)
    await session.run(`
      CREATE VECTOR INDEX segment_embeddings IF NOT EXISTS
      FOR (s:Segment)
      ON s.embedding
      OPTIONS {indexConfig: {
        \`vector.dimensions\`: 768,
        \`vector.similarity_function\`: 'cosine'
      }}
    `).catch((err) => {
      if (!err.message.includes('already exists') && !err.message.includes('equivalent index')) {
        throw err;
      }
      console.log('Segment vector index already exists');
    });

    console.log('Vector indexes initialized successfully');
  } finally {
    await session.close();
  }
}

/**
 * Find similar concepts using vector search (workspace-scoped)
 */
export async function findSimilarConcepts(
  queryText: string,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<SimilarConcept[]> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(queryText);

    // Vector search using shared index, filtered by workspace
    // Query more results to account for workspace filtering
    // Use neo4j.int() to ensure integers are passed correctly
    const queryLimit = neo4j.int(limit * 3);
    const finalLimit = neo4j.int(limit);

    const result = await session.run(`
      CALL db.index.vector.queryNodes(
        'concept_embeddings',
        $queryLimit,
        $embedding
      )
      YIELD node, score
      WHERE score > $minSimilarity AND node.workspace = $workspace
      RETURN
        node.concept_id as concept_id,
        node.canonical_name as canonical_name,
        node.aliases as aliases,
        node.category as category,
        node.total_mentions as total_mentions,
        score as similarity
      ORDER BY score DESC
      LIMIT $finalLimit
    `, { finalLimit, queryLimit, embedding, minSimilarity, workspace });

    return result.records.map(record => ({
      concept_id: record.get('concept_id'),
      canonical_name: record.get('canonical_name'),
      aliases: record.get('aliases') || [],
      category: record.get('category') || 'general',
      total_mentions: record.get('total_mentions') || 0,
      similarity: record.get('similarity'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Find similar segments using vector search (workspace-scoped)
 */
export async function findSimilarSegments(
  queryText: string,
  limit: number = 10,
  minSimilarity: number = 0.6
): Promise<SimilarSegment[]> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(queryText);

    // Vector search with related data using shared index, filtered by workspace
    // Query more results to account for workspace filtering
    // Use neo4j.int() to ensure integers are passed correctly
    const queryLimit = neo4j.int(limit * 3);
    const finalLimit = neo4j.int(limit);

    const result = await session.run(`
      CALL db.index.vector.queryNodes(
        'segment_embeddings',
        $queryLimit,
        $embedding
      )
      YIELD node, score
      WHERE score > $minSimilarity AND node.workspace = $workspace
      MATCH (node)-[:FROM_VIDEO]->(v:Video)
      OPTIONAL MATCH (node)-[d:DISCUSSES]->(c:Concept)
      WITH node, score, v,
           collect({
             name: c.canonical_name,
             id: c.concept_id,
             role: d.role
           }) as concepts
      RETURN
        node.segment_id as segment_id,
        node.topic_hint as topic_hint,
        node.start_time as start_time,
        node.end_time as end_time,
        node.transcript as transcript,
        score as similarity,
        v.url as video_url,
        v.title as video_title,
        concepts
      ORDER BY score DESC
      LIMIT $finalLimit
    `, { finalLimit, queryLimit, embedding, minSimilarity, workspace });

    return result.records.map(record => ({
      segment_id: record.get('segment_id'),
      topic_hint: record.get('topic_hint'),
      start_time: record.get('start_time'),
      end_time: record.get('end_time'),
      transcript: record.get('transcript') || '',
      similarity: record.get('similarity'),
      video_url: record.get('video_url'),
      video_title: record.get('video_title'),
      concepts: record.get('concepts').filter((c: any) => c.id !== null),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Semantic search for chatbot RAG
 */
export async function semanticSearch(question: string) {
  const [concepts, segments] = await Promise.all([
    findSimilarConcepts(question, 5, 0.6),
    findSimilarSegments(question, 10, 0.6),
  ]);

  return { concepts, segments };
}
