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
 * Initialize vector indexes for the current workspace (called from initializeSchema)
 * Creates workspace-specific index names for complete isolation
 */
export async function createVectorIndexes(): Promise<void> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  try {
    // Create concept embeddings index for this workspace
    await session.run(`
      CALL db.index.vector.createNodeIndex(
        'concept_embeddings_${workspace}',
        'Concept',
        'embedding',
        768,
        'cosine'
      )
    `).catch((err) => {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log(`Concept vector index already exists for workspace '${workspace}'`);
    });

    // Create segment embeddings index for this workspace
    await session.run(`
      CALL db.index.vector.createNodeIndex(
        'segment_embeddings_${workspace}',
        'Segment',
        'embedding',
        768,
        'cosine'
      )
    `).catch((err) => {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log(`Segment vector index already exists for workspace '${workspace}'`);
    });

    console.log(`Vector indexes initialized successfully for workspace '${workspace}'`);
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

    // Vector search using workspace-specific index
    const result = await session.run(`
      CALL db.index.vector.queryNodes(
        'concept_embeddings_${workspace}',
        $limit,
        $embedding
      )
      YIELD node, score
      WHERE score > $minSimilarity
      RETURN
        node.concept_id as concept_id,
        node.canonical_name as canonical_name,
        node.aliases as aliases,
        node.category as category,
        node.total_mentions as total_mentions,
        score as similarity
      ORDER BY score DESC
    `, { limit, embedding, minSimilarity });

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

    // Vector search with related data using workspace-specific index
    const result = await session.run(`
      CALL db.index.vector.queryNodes(
        'segment_embeddings_${workspace}',
        $limit,
        $embedding
      )
      YIELD node, score
      WHERE score > $minSimilarity
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
    `, { limit, embedding, minSimilarity });

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
