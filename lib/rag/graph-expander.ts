import neo4j, { Driver } from 'neo4j-driver';

export interface RelatedSegment {
  segment_id: string;
  topic_hint: string;
  similarity_score: number;
  shared_concept_count: number;
  connecting_concepts: string[];
  preview?: string;
}

export interface GraphExpansionOptions {
  similarityThreshold?: number;  // Default: 0.8
  topKSimilarConcepts?: number;  // Default: 10
  maxRelatedSegments?: number;   // Default: 10
  minSharedConcepts?: number;    // Default: 1
}

/**
 * Expands RAG search results using concept similarity to find related segments
 * that share semantically similar concepts, even if not exact matches.
 */
export async function expandWithConceptSimilarity(
  driver: Driver,
  retrievedSegmentIds: string[],
  options: GraphExpansionOptions = {}
): Promise<RelatedSegment[]> {
  const {
    similarityThreshold = 0.8,
    topKSimilarConcepts = 10,
    maxRelatedSegments = 10,
    minSharedConcepts = 1,
  } = options;

  const session = driver.session();

  try {
    const result = await session.run(
      `
      // Get concepts from retrieved segments
      MATCH (retrieved:Segment)-[:DISCUSSES]->(retrievedConcept:Concept)
      WHERE retrieved.segment_id IN $retrievedSegmentIds
      WITH COLLECT(DISTINCT retrievedConcept) as retrievedConcepts

      // Find similar concepts using vector similarity
      UNWIND retrievedConcepts as concept
      CALL db.index.vector.queryNodes('concept_embeddings', $topK, concept.embedding)
      YIELD node as similarConcept, score
      WHERE similarConcept.concept_id <> concept.concept_id
        AND score > $threshold

      // Find segments that discuss these similar concepts
      MATCH (similarConcept)<-[:DISCUSSES]-(related:Segment)
      WHERE NOT related.segment_id IN $retrievedSegmentIds

      WITH related,
           COUNT(DISTINCT similarConcept) as similar_concept_count,
           COLLECT(DISTINCT similarConcept.canonical_name) as similar_concepts,
           AVG(score) as avg_similarity
      WHERE similar_concept_count >= $minShared

      RETURN related.segment_id as segment_id,
             related.topic_hint as topic_hint,
             substring(related.transcript, 0, 200) as preview,
             similar_concept_count,
             similar_concepts,
             avg_similarity
      ORDER BY avg_similarity DESC, similar_concept_count DESC
      LIMIT $maxSegments
      `,
      {
        retrievedSegmentIds,
        threshold: similarityThreshold,
        topK: neo4j.int(topKSimilarConcepts),
        minShared: neo4j.int(minSharedConcepts),
        maxSegments: neo4j.int(maxRelatedSegments),
      }
    );

    return result.records.map((record) => ({
      segment_id: record.get('segment_id'),
      topic_hint: record.get('topic_hint'),
      similarity_score: record.get('avg_similarity'),
      shared_concept_count: record.get('similar_concept_count').toInt(),
      connecting_concepts: record.get('similar_concepts'),
      preview: record.get('preview'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Groups related segments into topic clusters for better UX
 */
export function groupRelatedSegmentsByTopic(
  segments: RelatedSegment[]
): Map<string, RelatedSegment[]> {
  const groups = new Map<string, RelatedSegment[]>();

  for (const segment of segments) {
    // Extract main topic from topic_hint (simple heuristic: first sentence/phrase)
    const mainTopic = segment.topic_hint.split(':')[0].trim();

    if (!groups.has(mainTopic)) {
      groups.set(mainTopic, []);
    }
    groups.get(mainTopic)!.push(segment);
  }

  return groups;
}
