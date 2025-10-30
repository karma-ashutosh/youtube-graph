import neo4j from "neo4j-driver";
import { getSession } from "./client";
import { Concept, Video, Segment } from "../types";

/**
 * Get all existing concepts (for normalization cache)
 */
export async function getAllConcepts(): Promise<Concept[]> {
  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (c:Concept)
      RETURN DISTINCT c
      ORDER BY c.total_mentions DESC
    `);

    return result.records.map((record) => {
      const node = record.get("c").properties;
      return {
        concept_id: node.concept_id,
        canonical_name: node.canonical_name,
        aliases: node.aliases || [],
        category: node.category || "Uncategorized",
        first_mentioned: new Date(node.first_mentioned),
        last_mentioned: new Date(node.last_mentioned),
        total_mentions: neo4j.isInt(node.total_mentions)
          ? node.total_mentions.toNumber()
          : node.total_mentions || 0,
        importance_score: node.importance_score || 0,
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * Create or get a video node
 */
export async function createOrGetVideo(
  videoId: string,
  url: string
): Promise<void> {
  const session = getSession();

  try {
    await session.run(
      `
      MERGE (v:Video {video_id: $video_id})
      ON CREATE SET
        v.url = $url,
        v.created_at = datetime()
      RETURN v
    `,
      { video_id: videoId, url }
    );
  } finally {
    await session.close();
  }
}

/**
 * Create a segment node
 */
export async function createSegment(params: {
  segmentId: string;
  videoId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  topicHint: string;
}): Promise<void> {
  const session = getSession();

  try {
    await session.run(
      `
      MATCH (v:Video {video_id: $video_id})
      CREATE (s:Segment {
        segment_id: $segment_id,
        video_id: $video_id,
        start_time: $start_time,
        end_time: $end_time,
        duration_seconds: $duration_seconds,
        topic_hint: $topic_hint,
        created_at: datetime()
      })
      CREATE (s)-[:FROM_VIDEO]->(v)
      RETURN s
    `,
      {
        video_id: params.videoId,
        segment_id: params.segmentId,
        start_time: params.startTime,
        end_time: params.endTime,
        duration_seconds: params.durationSeconds,
        topic_hint: params.topicHint,
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Create a new concept node
 */
export async function createConcept(params: {
  conceptId: string;
  canonicalName: string;
  aliases: string[];
  category?: string;
}): Promise<void> {
  const session = getSession();

  try {
    await session.run(
      `
      CREATE (c:Concept {
        concept_id: $concept_id,
        canonical_name: $canonical_name,
        aliases: $aliases,
        category: $category,
        first_mentioned: datetime(),
        last_mentioned: datetime(),
        total_mentions: 1,
        importance_score: 0.5
      })
      RETURN c
    `,
      {
        concept_id: params.conceptId,
        canonical_name: params.canonicalName,
        aliases: params.aliases,
        category: params.category || "Uncategorized",
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Update an existing concept (add alias, increment mentions)
 */
export async function updateConcept(params: {
  conceptId: string;
  newAlias?: string;
}): Promise<void> {
  const session = getSession();

  try {
    if (params.newAlias) {
      await session.run(
        `
        MATCH (c:Concept {concept_id: $concept_id})
        SET c.aliases = CASE
          WHEN NOT $new_alias IN c.aliases
          THEN c.aliases + [$new_alias]
          ELSE c.aliases
        END,
        c.total_mentions = c.total_mentions + 1,
        c.last_mentioned = datetime()
        RETURN c
      `,
        {
          concept_id: params.conceptId,
          new_alias: params.newAlias,
        }
      );
    } else {
      await session.run(
        `
        MATCH (c:Concept {concept_id: $concept_id})
        SET c.total_mentions = c.total_mentions + 1,
            c.last_mentioned = datetime()
        RETURN c
      `,
        {
          concept_id: params.conceptId,
        }
      );
    }
  } finally {
    await session.close();
  }
}

/**
 * Link a segment to a concept with a specific role
 */
export async function linkSegmentToConcept(params: {
  segmentId: string;
  conceptId: string;
  role: "primary" | "supporting" | "mentioned";
  coverageDepth: string;
  explanationType?: string;
}): Promise<void> {
  const session = getSession();

  try {
    const queryParams: Record<string, any> = {
      segment_id: params.segmentId,
      concept_id: params.conceptId,
      role: params.role,
      coverage_depth: params.coverageDepth,
    };

    let query = `
      MATCH (s:Segment {segment_id: $segment_id})
      MATCH (c:Concept {concept_id: $concept_id})
      CREATE (s)-[:DISCUSSES {
        role: $role,
        coverage_depth: $coverage_depth`;

    if (params.explanationType) {
      query += `,
        explanation_type: $explanation_type`;
      queryParams.explanation_type = params.explanationType;
    }

    query += `
      }]->(c)
    `;

    await session.run(query, queryParams);
  } finally {
    await session.close();
  }
}

/**
 * Create an example node and link it to concept and segment
 */
export async function createExample(params: {
  exampleId: string;
  exampleText: string;
  exampleType: string;
  conceptId: string;
  segmentId: string;
  companyName?: string;
}): Promise<void> {
  const session = getSession();

  try {
    const queryParams: Record<string, any> = {
      concept_id: params.conceptId,
      segment_id: params.segmentId,
      example_id: params.exampleId,
      example_text: params.exampleText,
      example_type: params.exampleType,
    };

    let query = `
      MATCH (c:Concept {concept_id: $concept_id})
      MATCH (s:Segment {segment_id: $segment_id})
      CREATE (e:Example {
        example_id: $example_id,
        example_text: $example_text,
        example_type: $example_type,
        segment_id: $segment_id`;

    if (params.companyName) {
      query += `,
        company_name: $company_name`;
      queryParams.company_name = params.companyName;
    }

    query += `
      })
      CREATE (e)-[:ILLUSTRATES]->(c)
      CREATE (e)-[:MENTIONED_IN]->(s)
    `;

    await session.run(query, queryParams);
  } finally {
    await session.close();
  }
}

/**
 * Create a key idea node and link it to concept and segment
 */
export async function createKeyIdea(params: {
  ideaId: string;
  ideaText: string;
  ideaType: string;
  isNovel: boolean;
  confidence: string;
  conceptId: string;
  segmentId: string;
}): Promise<void> {
  const session = getSession();

  try {
    await session.run(
      `
      MATCH (c:Concept {concept_id: $concept_id})
      MATCH (s:Segment {segment_id: $segment_id})
      CREATE (ki:KeyIdea {
        idea_id: $idea_id,
        idea_text: $idea_text,
        idea_type: $idea_type,
        is_novel: $is_novel,
        confidence: $confidence,
        segment_id: $segment_id
      })
      CREATE (ki)-[:ABOUT]->(c)
      CREATE (ki)-[:EXTRACTED_FROM]->(s)
    `,
      {
        concept_id: params.conceptId,
        segment_id: params.segmentId,
        idea_id: params.ideaId,
        idea_text: params.ideaText,
        idea_type: params.ideaType,
        is_novel: params.isNovel,
        confidence: params.confidence,
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Get a concept by ID with all its relationships
 */
export async function getConceptById(conceptId: string) {
  const session = getSession();

  try {
    const result = await session.run(
      `
      MATCH (c:Concept {concept_id: $concept_id})

      OPTIONAL MATCH (c)<-[d:DISCUSSES]-(s:Segment)-[:FROM_VIDEO]->(v:Video)
      OPTIONAL MATCH (c)<-[:ILLUSTRATES]-(e:Example)
      OPTIONAL MATCH (c)<-[:ABOUT]-(ki:KeyIdea)
      OPTIONAL MATCH (c)-[r:RELATED_TO]-(related:Concept)

      RETURN c,
             collect(DISTINCT {segment: s, video: v, discusses: d}) as segments,
             collect(DISTINCT e) as examples,
             collect(DISTINCT ki) as key_ideas,
             collect(DISTINCT {concept: related, strength: r.strength}) as related_concepts
      `,
      { concept_id: conceptId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      concept: record.get("c").properties,
      segments: record.get("segments"),
      examples: record.get("examples").map((e: any) => e?.properties).filter(Boolean),
      keyIdeas: record.get("key_ideas").map((ki: any) => ki?.properties).filter(Boolean),
      relatedConcepts: record.get("related_concepts"),
    };
  } finally {
    await session.close();
  }
}

/**
 * Get graph data for visualization
 */
export async function getGraphData(params?: {
  minMentions?: number;
  category?: string;
  limit?: number;
}) {
  const session = getSession();

  try {
    let conceptQuery = `
      MATCH (c:Concept)
      WHERE c.total_mentions >= $min_mentions
    `;

    if (params?.category) {
      conceptQuery += ` AND c.category = $category`;
    }

    conceptQuery += `
      RETURN c
      ORDER BY c.total_mentions DESC
      LIMIT $limit
    `;

    // Get concepts first
    const conceptResult = await session.run(conceptQuery, {
      min_mentions: neo4j.int(params?.minMentions || 0),
      category: params?.category,
      limit: neo4j.int(params?.limit || 100),
    });

    const concepts = conceptResult.records.map((record) => record.get("c").properties);

    if (concepts.length === 0) {
      return { nodes: [], links: [] };
    }

    // Get concept IDs for link query
    const conceptIds = concepts.map((c: any) => c.concept_id);

    // Find links between concepts (co-occurrence in segments)
    const linkQuery = `
      MATCH (c1:Concept)<-[:DISCUSSES]-(s:Segment)-[:DISCUSSES]->(c2:Concept)
      WHERE c1.concept_id IN $concept_ids
        AND c2.concept_id IN $concept_ids
        AND c1.concept_id < c2.concept_id
      RETURN c1.concept_id as source, c2.concept_id as target, count(s) as strength
    `;

    const linkResult = await session.run(linkQuery, {
      concept_ids: conceptIds,
    });

    const links = linkResult.records.map((record) => ({
      source: record.get("source"),
      target: record.get("target"),
      strength: neo4j.isInt(record.get("strength"))
        ? record.get("strength").toNumber()
        : record.get("strength"),
    }));

    return {
      nodes: concepts.map((c: any) => ({
        id: c.concept_id,
        label: c.canonical_name,
        type: "concept",
        mentions: neo4j.isInt(c.total_mentions) ? c.total_mentions.toNumber() : c.total_mentions || 0,
        importance: c.importance_score || 0,
        category: c.category || "Uncategorized",
      })),
      links,
    };
  } finally {
    await session.close();
  }
}
