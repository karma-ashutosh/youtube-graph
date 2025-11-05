import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/neo4j/client";
import { generateEmbedding } from "@/lib/ai/embeddings";

/**
 * POST /api/backfill
 *
 * Backfill embeddings for concepts and segments that don't have them
 * This endpoint uses the same API keys configured for the chat feature
 */
export async function POST(request: NextRequest) {
  const session = getSession();

  try {
    let totalProcessed = 0;
    let totalFailed = 0;
    const results = {
      concepts: { processed: 0, failed: 0, total: 0 },
      segments: { processed: 0, failed: 0, total: 0 },
    };

    // Backfill concepts
    const conceptsResult = await session.run(`
      MATCH (c:Concept)
      WHERE c.embedding IS NULL
      RETURN c.concept_id as id, c.canonical_name as name
      ORDER BY c.total_mentions DESC
      LIMIT 100
    `);

    results.concepts.total = conceptsResult.records.length;

    for (const record of conceptsResult.records) {
      const id = record.get("id");
      const name = record.get("name");

      try {
        const embedding = await generateEmbedding(name);

        await session.run(
          `
          MATCH (c:Concept {concept_id: $id})
          SET c.embedding = $embedding
        `,
          { id, embedding }
        );

        results.concepts.processed++;
        totalProcessed++;

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to generate embedding for concept "${name}":`, error);
        results.concepts.failed++;
        totalFailed++;
      }
    }

    // Backfill segments
    const segmentsResult = await session.run(`
      MATCH (s:Segment)
      WHERE s.embedding IS NULL
      RETURN s.segment_id as id, s.topic_hint as topic, s.transcript as transcript
      ORDER BY s.created_at DESC
      LIMIT 100
    `);

    results.segments.total = segmentsResult.records.length;

    for (const record of segmentsResult.records) {
      const id = record.get("id");
      const topic = record.get("topic");
      const transcript = record.get("transcript") || "";

      try {
        // Combine topic and transcript excerpt for embedding
        const textToEmbed = `${topic}. ${transcript.slice(0, 500)}`;
        const embedding = await generateEmbedding(textToEmbed);

        await session.run(
          `
          MATCH (s:Segment {segment_id: $id})
          SET s.embedding = $embedding
        `,
          { id, embedding }
        );

        results.segments.processed++;
        totalProcessed++;

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to generate embedding for segment "${topic}":`, error);
        results.segments.failed++;
        totalFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete! Processed ${totalProcessed} embeddings.`,
      results,
    });
  } catch (error) {
    console.error("Backfill error:", error);

    return NextResponse.json(
      {
        error: "Failed to backfill embeddings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

/**
 * GET /api/backfill
 *
 * Get status of embeddings (how many concepts/segments need backfilling)
 */
export async function GET(request: NextRequest) {
  const session = getSession();

  try {
    const conceptsResult = await session.run(`
      MATCH (c:Concept)
      WHERE c.embedding IS NULL
      RETURN count(c) as count
    `);

    const segmentsResult = await session.run(`
      MATCH (s:Segment)
      WHERE s.embedding IS NULL
      RETURN count(s) as count
    `);

    const conceptsNeedingEmbeddings = conceptsResult.records[0]?.get("count").toNumber() || 0;
    const segmentsNeedingEmbeddings = segmentsResult.records[0]?.get("count").toNumber() || 0;

    return NextResponse.json({
      success: true,
      status: {
        concepts: {
          needingEmbeddings: conceptsNeedingEmbeddings,
        },
        segments: {
          needingEmbeddings: segmentsNeedingEmbeddings,
        },
        total: conceptsNeedingEmbeddings + segmentsNeedingEmbeddings,
      },
    });
  } catch (error) {
    console.error("Status check error:", error);

    return NextResponse.json(
      {
        error: "Failed to check status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
