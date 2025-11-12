import neo4j from 'neo4j-driver';
import { getSession } from './client';
import { generateEmbedding } from '../ai/embeddings';
import { getCurrentWorkspace } from '../workspace-context';
import { debugLogger } from '../debug-logger';
import { expandWithConceptSimilarity, RelatedSegment } from '../rag/graph-expander';
import { getDriver } from './client';

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
  minSimilarity: number = 0.7,
  requestId?: string
): Promise<SimilarConcept[]> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  debugLogger.log("findSimilarConcepts", "start", {
    requestId,
    queryTextLength: queryText.length,
    limit,
    minSimilarity,
    workspace,
  });

  try {
    // Generate embedding for query
    const embeddingStart = Date.now();
    const embedding = await generateEmbedding(queryText, requestId);
    const embeddingDuration = Date.now() - embeddingStart;

    debugLogger.log("findSimilarConcepts", "embedding_generated", {
      requestId,
      embeddingDimensions: embedding.length,
      durationMs: embeddingDuration,
    });

    // Vector search using shared index, filtered by workspace
    // Query more results to account for workspace filtering
    // Use neo4j.int() to ensure integers are passed correctly
    const queryLimit = neo4j.int(limit * 3);
    const finalLimit = neo4j.int(limit);

    debugLogger.log("findSimilarConcepts", "vector_search_start", {
      requestId,
      queryLimit: limit * 3,
      finalLimit: limit,
      workspace,
    });

    const searchStart = Date.now();
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
    const searchDuration = Date.now() - searchStart;

    const concepts = result.records.map(record => ({
      concept_id: record.get('concept_id'),
      canonical_name: record.get('canonical_name'),
      aliases: record.get('aliases') || [],
      category: record.get('category') || 'general',
      total_mentions: record.get('total_mentions') || 0,
      similarity: record.get('similarity'),
    }));

    debugLogger.log("findSimilarConcepts", "complete", {
      requestId,
      resultsFound: concepts.length,
      durationMs: searchDuration,
      similarityRange: concepts.length > 0 ? {
        min: Math.min(...concepts.map(c => c.similarity)),
        max: Math.max(...concepts.map(c => c.similarity)),
      } : null,
    });

    return concepts;
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
  minSimilarity: number = 0.6,
  requestId?: string
): Promise<SimilarSegment[]> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  debugLogger.log("findSimilarSegments", "start", {
    requestId,
    queryTextLength: queryText.length,
    limit,
    minSimilarity,
    workspace,
  });

  try {
    // Generate embedding for query
    const embeddingStart = Date.now();
    const embedding = await generateEmbedding(queryText, requestId);
    const embeddingDuration = Date.now() - embeddingStart;

    debugLogger.log("findSimilarSegments", "embedding_generated", {
      requestId,
      embeddingDimensions: embedding.length,
      durationMs: embeddingDuration,
    });

    // Vector search with related data using shared index, filtered by workspace
    // Query more results to account for workspace filtering
    // Use neo4j.int() to ensure integers are passed correctly
    const queryLimit = neo4j.int(limit * 3);
    const finalLimit = neo4j.int(limit);

    debugLogger.log("findSimilarSegments", "vector_search_start", {
      requestId,
      queryLimit: limit * 3,
      finalLimit: limit,
      workspace,
    });

    const searchStart = Date.now();
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
    const searchDuration = Date.now() - searchStart;

    const segments = result.records.map(record => ({
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

    debugLogger.log("findSimilarSegments", "complete", {
      requestId,
      resultsFound: segments.length,
      durationMs: searchDuration,
      similarityRange: segments.length > 0 ? {
        min: Math.min(...segments.map(s => s.similarity)),
        max: Math.max(...segments.map(s => s.similarity)),
      } : null,
      totalConceptsInSegments: segments.reduce((sum, s) => sum + s.concepts.length, 0),
    });

    return segments;
  } finally {
    await session.close();
  }
}

/**
 * Fetch segments by IDs for user-included topics
 */
export async function getSegmentsByIds(segmentIds: string[]): Promise<SimilarSegment[]> {
  const workspace = getCurrentWorkspace();
  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (s:Segment)-[:FROM_VIDEO]->(v:Video)
      WHERE s.segment_id IN $segmentIds AND s.workspace = $workspace
      OPTIONAL MATCH (s)-[d:DISCUSSES]->(c:Concept)
      WITH s, v,
           collect({
             name: c.canonical_name,
             id: c.concept_id,
             role: d.role
           }) as concepts
      RETURN
        s.segment_id as segment_id,
        s.topic_hint as topic_hint,
        s.start_time as start_time,
        s.end_time as end_time,
        s.transcript as transcript,
        1.0 as similarity,
        v.url as video_url,
        v.title as video_title,
        concepts
    `, { segmentIds, workspace });

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
 * Semantic search for chatbot RAG with graph expansion
 */
export async function semanticSearch(
  question: string,
  requestId?: string,
  includeSegmentIds?: string[]
) {
  debugLogger.log("semanticSearch", "start", {
    requestId,
    question,
    includeSegmentIds: includeSegmentIds?.length || 0,
  });

  const startTime = Date.now();

  // Fetch included segments and semantic search in parallel
  // Use higher threshold (0.75) and cap total segments at 5
  const HIGH_QUALITY_THRESHOLD = 0.75;
  const FALLBACK_THRESHOLD = 0.6;
  const MAX_TOTAL_SEGMENTS = 5;

  const promises: Promise<any>[] = [
    findSimilarConcepts(question, 5, 0.6, requestId),
    findSimilarSegments(question, 10, FALLBACK_THRESHOLD, requestId), // Fetch more to filter
  ];

  if (includeSegmentIds && includeSegmentIds.length > 0) {
    promises.push(getSegmentsByIds(includeSegmentIds));
  }

  const results = await Promise.all(promises);
  const concepts = results[0];
  let ragSegments = results[1];
  const includedSegments = results[2] || [];

  // Calculate how many RAG segments we can include
  const userIncludedCount = includedSegments.length;
  const maxRagSegments = Math.max(1, MAX_TOTAL_SEGMENTS - userIncludedCount);

  debugLogger.log("semanticSearch", "segment_budget", {
    requestId,
    userIncluded: userIncludedCount,
    maxRagSegments: maxRagSegments,
    totalBudget: MAX_TOTAL_SEGMENTS,
  });

  // Smart filtering: prioritize high-quality matches
  let segments: SimilarSegment[] = [];

  // Strategy 1: If we have high-quality matches (>75%), use those (up to budget)
  const highQualitySegments = ragSegments.filter((s: SimilarSegment) => s.similarity > HIGH_QUALITY_THRESHOLD);

  if (highQualitySegments.length > 0) {
    segments = highQualitySegments.slice(0, maxRagSegments);
    debugLogger.log("semanticSearch", "using_high_quality", {
      requestId,
      count: segments.length,
      minSimilarity: Math.min(...segments.map((s: SimilarSegment) => s.similarity)),
    });
  }
  // Strategy 2: If no high-quality matches, keep only top 1-2 best matches (up to budget)
  else if (ragSegments.length > 0) {
    const topMatches = Math.min(
      maxRagSegments,
      userIncludedCount > 0 ? 2 : 1
    );
    segments = ragSegments.slice(0, topMatches);
    debugLogger.log("semanticSearch", "using_fallback", {
      requestId,
      count: segments.length,
      topSimilarity: segments[0]?.similarity,
      note: "No high-quality matches, using top match(es) only",
    });
  }

  // Merge user-included segments at the top (always included regardless of similarity)
  if (includedSegments.length > 0) {
    segments = [...includedSegments, ...segments];
  }

  const duration = Date.now() - startTime;

  debugLogger.log("semanticSearch", "complete", {
    requestId,
    conceptsFound: concepts.length,
    segmentsFound: segments.length,
    includedSegments: includedSegments.length,
    durationMs: duration,
  });

  // Graph expansion: find related segments through concept similarity
  // Use all segments (including user-included) for expansion
  let relatedSegments: RelatedSegment[] = [];
  if (segments.length > 0) {
    debugLogger.log("semanticSearch", "graph_expansion_start", {
      requestId,
      retrievedSegmentCount: segments.length,
    });

    const expansionStart = Date.now();
    try {
      const driver = getDriver();
      const segmentIds = segments.map((s: SimilarSegment) => s.segment_id);

      relatedSegments = await expandWithConceptSimilarity(driver, segmentIds, {
        similarityThreshold: 0.8,
        topKSimilarConcepts: 10,
        maxRelatedSegments: 5,
        minSharedConcepts: 1,
      });

      debugLogger.log("semanticSearch", "graph_expansion_complete", {
        requestId,
        relatedSegmentsFound: relatedSegments.length,
        durationMs: Date.now() - expansionStart,
      });
    } catch (error) {
      debugLogger.log("semanticSearch", "graph_expansion_error", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("Graph expansion failed:", error);
      // Continue without related segments if expansion fails
    }
  }

  return { concepts, segments, relatedSegments };
}
