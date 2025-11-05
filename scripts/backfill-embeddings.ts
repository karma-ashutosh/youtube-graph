#!/usr/bin/env tsx

/**
 * Backfill script to generate embeddings for existing concepts and segments
 *
 * Usage: npx tsx scripts/backfill-embeddings.ts
 */

// IMPORTANT: Load environment variables BEFORE any other imports
import "dotenv/config";

import { getSession, closeDriver } from "../lib/neo4j/client";
import { generateEmbedding } from "../lib/ai/embeddings";

async function backfillConceptEmbeddings() {
  const session = getSession();

  try {
    // Get concepts without embeddings
    const result = await session.run(`
      MATCH (c:Concept)
      WHERE c.embedding IS NULL
      RETURN c.concept_id as id, c.canonical_name as name
      ORDER BY c.total_mentions DESC
    `);

    console.log(`\n📊 Found ${result.records.length} concepts without embeddings`);

    if (result.records.length === 0) {
      console.log("✅ All concepts already have embeddings!");
      return 0;
    }

    let processed = 0;
    let failed = 0;

    for (const record of result.records) {
      const id = record.get('id');
      const name = record.get('name');

      try {
        console.log(`[${processed + 1}/${result.records.length}] Generating embedding for: "${name}"`);

        const embedding = await generateEmbedding(name);

        await session.run(`
          MATCH (c:Concept {concept_id: $id})
          SET c.embedding = $embedding
        `, { id, embedding });

        processed++;

        // Rate limiting to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to generate embedding for "${name}":`, error);
        failed++;
      }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed: ${failed}`);

    return processed;
  } finally {
    await session.close();
  }
}

async function backfillSegmentEmbeddings() {
  const session = getSession();

  try {
    // Get segments without embeddings
    const result = await session.run(`
      MATCH (s:Segment)
      WHERE s.embedding IS NULL
      RETURN s.segment_id as id, s.topic_hint as topic, s.transcript as transcript
      ORDER BY s.created_at DESC
    `);

    console.log(`\n📊 Found ${result.records.length} segments without embeddings`);

    if (result.records.length === 0) {
      console.log("✅ All segments already have embeddings!");
      return 0;
    }

    let processed = 0;
    let failed = 0;

    for (const record of result.records) {
      const id = record.get('id');
      const topic = record.get('topic');
      const transcript = record.get('transcript') || '';

      try {
        console.log(`[${processed + 1}/${result.records.length}] Generating embedding for segment: "${topic}"`);

        // Combine topic and transcript excerpt for embedding
        const textToEmbed = `${topic}. ${transcript.slice(0, 500)}`;
        const embedding = await generateEmbedding(textToEmbed);

        await session.run(`
          MATCH (s:Segment {segment_id: $id})
          SET s.embedding = $embedding
        `, { id, embedding });

        processed++;

        // Rate limiting to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to generate embedding for segment "${topic}":`, error);
        failed++;
      }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed: ${failed}`);

    return processed;
  } finally {
    await session.close();
  }
}

async function main() {
  console.log("🚀 Starting embedding backfill process...\n");
  console.log("This will generate embeddings for all concepts and segments that don't have them yet.");
  console.log("Using Google Gemini text-embedding-004 (768 dimensions)\n");

  try {
    // Backfill concepts
    console.log("=" .repeat(60));
    console.log("PHASE 1: Concept Embeddings");
    console.log("=".repeat(60));
    const conceptsProcessed = await backfillConceptEmbeddings();

    // Backfill segments
    console.log("\n" + "=".repeat(60));
    console.log("PHASE 2: Segment Embeddings");
    console.log("=".repeat(60));
    const segmentsProcessed = await backfillSegmentEmbeddings();

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total concepts processed: ${conceptsProcessed}`);
    console.log(`Total segments processed: ${segmentsProcessed}`);
    console.log(`\n✅ Embedding backfill complete!`);
    console.log(`\nYou can now use the chat feature with semantic search.`);
  } catch (error) {
    console.error("\n❌ Fatal error during backfill:", error);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

// Run the script
main();
