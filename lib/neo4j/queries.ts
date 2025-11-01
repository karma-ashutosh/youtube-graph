import neo4j from "neo4j-driver";
import { getSession } from "./client";
import { Concept, Video, Segment, GraphNode, GraphLink } from "../types";

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
 * Get all concepts with role statistics (for UI filtering)
 */
export async function getAllConceptsWithRoles() {
  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (c:Concept)
      OPTIONAL MATCH (s:Segment)-[d:DISCUSSES]->(c)
      WITH c,
           sum(CASE WHEN d.role = 'primary' THEN 1 ELSE 0 END) as primary_count,
           sum(CASE WHEN d.role = 'supporting' THEN 1 ELSE 0 END) as supporting_count,
           sum(CASE WHEN d.role = 'mentioned' THEN 1 ELSE 0 END) as mentioned_count,
           collect(DISTINCT d.role) as roles
      RETURN c, primary_count, supporting_count, mentioned_count, roles
      ORDER BY c.total_mentions DESC
    `);

    return result.records.map((record) => {
      const node = record.get("c").properties;
      const primaryCount = record.get("primary_count");
      const supportingCount = record.get("supporting_count");
      const mentionedCount = record.get("mentioned_count");
      const roles = record.get("roles");

      return {
        concept_id: node.concept_id,
        canonical_name: node.canonical_name,
        aliases: node.aliases || [],
        category: node.category || "Uncategorized",
        first_mentioned: node.first_mentioned,
        last_mentioned: node.last_mentioned,
        total_mentions: neo4j.isInt(node.total_mentions)
          ? node.total_mentions.toNumber()
          : node.total_mentions || 0,
        importance_score: node.importance_score || 0,
        primary_count: neo4j.isInt(primaryCount) ? primaryCount.toNumber() : primaryCount || 0,
        supporting_count: neo4j.isInt(supportingCount) ? supportingCount.toNumber() : supportingCount || 0,
        mentioned_count: neo4j.isInt(mentionedCount) ? mentionedCount.toNumber() : mentionedCount || 0,
        roles: roles || [],
        has_primary: roles.includes("primary"),
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
  transcript?: string;
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
        transcript: $transcript,
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
        transcript: params.transcript || "",
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
      MERGE (c:Concept {concept_id: $concept_id})
      ON CREATE SET
        c.canonical_name = $canonical_name,
        c.aliases = $aliases,
        c.category = $category,
        c.first_mentioned = datetime(),
        c.last_mentioned = datetime(),
        c.total_mentions = 1,
        c.importance_score = 0.5
      ON MATCH SET
        c.last_mentioned = datetime(),
        c.total_mentions = c.total_mentions + 1
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
    const concept = record.get("c").properties;

    // Helper function to convert Neo4j integers to numbers
    const convertIntegers = (obj: any): any => {
      if (!obj) return obj;
      if (neo4j.isInt(obj)) return obj.toNumber();
      if (Array.isArray(obj)) return obj.map(convertIntegers);
      if (typeof obj === 'object') {
        const converted: any = {};
        for (const key in obj) {
          converted[key] = convertIntegers(obj[key]);
        }
        return converted;
      }
      return obj;
    };

    return {
      concept: convertIntegers(concept),
      segments: convertIntegers(record.get("segments")),
      examples: record.get("examples").map((e: any) => convertIntegers(e?.properties)).filter(Boolean),
      keyIdeas: record.get("key_ideas").map((ki: any) => convertIntegers(ki?.properties)).filter(Boolean),
      relatedConcepts: convertIntegers(record.get("related_concepts")),
    };
  } finally {
    await session.close();
  }
}

/**
 * Get all segments
 */
export async function getAllSegments(): Promise<any[]> {
  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (s:Segment)-[:FROM_VIDEO]->(v:Video)
      RETURN s, v
      ORDER BY s.created_at DESC
    `);

    return result.records.map((record) => {
      const segment = record.get("s").properties;
      const video = record.get("v").properties;

      // Convert Neo4j integers
      const convertIntegers = (obj: any): any => {
        if (!obj) return obj;
        if (neo4j.isInt(obj)) return obj.toNumber();
        if (typeof obj === 'object' && !Array.isArray(obj)) {
          const converted: any = {};
          for (const key in obj) {
            converted[key] = convertIntegers(obj[key]);
          }
          return converted;
        }
        return obj;
      };

      return {
        segment: convertIntegers(segment),
        video: convertIntegers(video),
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * Get a segment by ID with all its relationships
 */
export async function getSegmentById(segmentId: string) {
  const session = getSession();

  try {
    const result = await session.run(
      `
      MATCH (s:Segment {segment_id: $segment_id})-[:FROM_VIDEO]->(v:Video)

      OPTIONAL MATCH (s)-[d:DISCUSSES]->(c:Concept)
      OPTIONAL MATCH (e:Example)-[:MENTIONED_IN]->(s)
      OPTIONAL MATCH (ki:KeyIdea)-[:EXTRACTED_FROM]->(s)

      RETURN s, v,
             collect(DISTINCT {concept: c, discusses: d}) as concepts,
             collect(DISTINCT e) as examples,
             collect(DISTINCT ki) as key_ideas
      `,
      { segment_id: segmentId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];

    // Helper function to convert Neo4j integers
    const convertIntegers = (obj: any): any => {
      if (!obj) return obj;
      if (neo4j.isInt(obj)) return obj.toNumber();
      if (Array.isArray(obj)) return obj.map(convertIntegers);
      if (typeof obj === 'object') {
        const converted: any = {};
        for (const key in obj) {
          converted[key] = convertIntegers(obj[key]);
        }
        return converted;
      }
      return obj;
    };

    return {
      segment: convertIntegers(record.get("s").properties),
      video: convertIntegers(record.get("v").properties),
      concepts: convertIntegers(record.get("concepts")),
      examples: record.get("examples").map((e: any) => convertIntegers(e?.properties)).filter(Boolean),
      keyIdeas: record.get("key_ideas").map((ki: any) => convertIntegers(ki?.properties)).filter(Boolean),
    };
  } finally {
    await session.close();
  }
}

/**
 * Get a video by ID with all its segments
 */
/**
 * Get all videos with segment counts
 */
export async function getAllVideos() {
  const session = getSession();

  try {
    const result = await session.run(`
      MATCH (v:Video)
      OPTIONAL MATCH (s:Segment)-[:FROM_VIDEO]->(v)
      WITH v, count(s) as segment_count
      ORDER BY v.created_at DESC
      RETURN v, segment_count
    `);

    return result.records.map((record) => {
      const video = record.get("v").properties;
      const segmentCount = record.get("segment_count");

      return {
        video_id: video.video_id,
        url: video.url,
        created_at: video.created_at,
        segment_count: neo4j.isInt(segmentCount) ? segmentCount.toNumber() : segmentCount || 0,
      };
    });
  } finally {
    await session.close();
  }
}

export async function getVideoById(videoId: string) {
  const session = getSession();

  try {
    const result = await session.run(
      `
      MATCH (v:Video {video_id: $video_id})
      OPTIONAL MATCH (s:Segment)-[:FROM_VIDEO]->(v)
      WITH v, s
      ORDER BY s.start_time
      RETURN v,
             collect(s) as segments
      `,
      { video_id: videoId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];

    // Helper function to convert Neo4j integers
    const convertIntegers = (obj: any): any => {
      if (!obj) return obj;
      if (neo4j.isInt(obj)) return obj.toNumber();
      if (Array.isArray(obj)) return obj.map(convertIntegers);
      if (typeof obj === 'object') {
        const converted: any = {};
        for (const key in obj) {
          converted[key] = convertIntegers(obj[key]);
        }
        return converted;
      }
      return obj;
    };

    return {
      video: convertIntegers(record.get("v").properties),
      segments: record.get("segments").map((s: any) => convertIntegers(s?.properties)).filter(Boolean),
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
  includeSegments?: boolean;
  roleFilter?: string;
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

    // Add role filter - only include concepts that have been discussed in the specified role
    if (params?.roleFilter && params.roleFilter !== "all") {
      if (params.roleFilter === "primary") {
        conceptQuery = `
          MATCH (c:Concept)<-[d:DISCUSSES]-(s:Segment)
          WHERE c.total_mentions >= $min_mentions
            AND d.role = 'primary'
            ${params?.category ? 'AND c.category = $category' : ''}
          WITH DISTINCT c
        `;
      } else {
        conceptQuery = `
          MATCH (c:Concept)<-[d:DISCUSSES]-(s:Segment)
          WHERE c.total_mentions >= $min_mentions
            AND d.role = $role_filter
            ${params?.category ? 'AND c.category = $category' : ''}
          WITH DISTINCT c
        `;
      }
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
      role_filter: params?.roleFilter,
    });

    const concepts = conceptResult.records.map((record) => record.get("c").properties);

    if (concepts.length === 0) {
      return { nodes: [], links: [] };
    }

    // Get concept IDs for link query
    const conceptIds = concepts.map((c: any) => c.concept_id);

    // Get role information for each concept
    const roleQuery = `
      MATCH (c:Concept)<-[d:DISCUSSES]-(s:Segment)
      WHERE c.concept_id IN $concept_ids
      WITH c.concept_id as concept_id,
           collect(DISTINCT d.role) as roles,
           sum(CASE WHEN d.role = 'primary' THEN 1 ELSE 0 END) as primary_count
      RETURN concept_id, roles, primary_count
    `;

    const roleResult = await session.run(roleQuery, {
      concept_ids: conceptIds,
    });

    // Create a map of concept_id -> role info
    const roleMap = new Map();
    roleResult.records.forEach((record) => {
      const conceptId = record.get("concept_id");
      const roles = record.get("roles");
      const primaryCount = record.get("primary_count");
      roleMap.set(conceptId, {
        roles,
        has_primary: roles.includes("primary"),
        primary_count: neo4j.isInt(primaryCount) ? primaryCount.toNumber() : primaryCount || 0,
      });
    });

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

    const links: GraphLink[] = linkResult.records.map((record) => ({
      source: record.get("source"),
      target: record.get("target"),
      strength: neo4j.isInt(record.get("strength"))
        ? record.get("strength").toNumber()
        : record.get("strength"),
      type: "concept-concept",
    }));

    const nodes: GraphNode[] = concepts.map((c: any) => {
      const roleInfo = roleMap.get(c.concept_id) || { roles: [], has_primary: false, primary_count: 0 };
      return {
        id: c.concept_id,
        label: c.canonical_name,
        type: "concept",
        mentions: neo4j.isInt(c.total_mentions) ? c.total_mentions.toNumber() : c.total_mentions || 0,
        importance: c.importance_score || 0,
        category: c.category || "Uncategorized",
        roles: roleInfo.roles,
        has_primary: roleInfo.has_primary,
        primary_count: roleInfo.primary_count,
      };
    });

    // If includeSegments is true, also add segment nodes and their links to concepts
    if (params?.includeSegments) {
      const segmentQuery = `
        MATCH (s:Segment)-[:DISCUSSES]->(c:Concept)
        WHERE c.concept_id IN $concept_ids
        WITH DISTINCT s
        LIMIT 20
        RETURN s
      `;

      const segmentResult = await session.run(segmentQuery, {
        concept_ids: conceptIds,
      });

      const segments = segmentResult.records.map((record) => record.get("s").properties);

      // Add segment nodes
      segments.forEach((s: any) => {
        nodes.push({
          id: s.segment_id,
          label: s.topic_hint.substring(0, 30) + (s.topic_hint.length > 30 ? "..." : ""),
          type: "segment",
          mentions: 0,
          importance: 0,
          category: "segment",
          duration: neo4j.isInt(s.duration_seconds) ? s.duration_seconds.toNumber() : s.duration_seconds,
        });
      });

      // Get segment-to-concept links
      const segmentLinkQuery = `
        MATCH (s:Segment)-[d:DISCUSSES]->(c:Concept)
        WHERE s.segment_id IN $segment_ids
          AND c.concept_id IN $concept_ids
        RETURN s.segment_id as source, c.concept_id as target, d.role as role
      `;

      const segmentLinkResult = await session.run(segmentLinkQuery, {
        segment_ids: segments.map((s: any) => s.segment_id),
        concept_ids: conceptIds,
      });

      segmentLinkResult.records.forEach((record) => {
        links.push({
          source: record.get("source"),
          target: record.get("target"),
          strength: 1,
          type: "segment-concept",
          role: record.get("role"),
        });
      });
    }

    return {
      nodes,
      links,
    };
  } finally {
    await session.close();
  }
}
