#!/usr/bin/env ts-node

/**
 * Database migration script
 * Run this to initialize or update the Neo4j schema
 *
 * Usage: npx ts-node scripts/migrate-db.ts
 */

import { initializeSchema, closeDriver, testConnection } from "../lib/neo4j/client";

async function migrate() {
  console.log("Starting database migration...");

  try {
    // Test connection first
    console.log("Testing Neo4j connection...");
    const connected = await testConnection();

    if (!connected) {
      console.error("Failed to connect to Neo4j. Please check your configuration.");
      process.exit(1);
    }

    console.log("Connected to Neo4j successfully.");

    // Initialize schema
    console.log("Initializing schema (creating constraints and indexes)...");
    await initializeSchema();

    console.log("\n✅ Migration completed successfully!");
    console.log("\nCreated:");
    console.log("  - Uniqueness constraints on concept_id, segment_id, video_id");
    console.log("  - Indexes on category, total_mentions, canonical_name, video_id");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

migrate();
