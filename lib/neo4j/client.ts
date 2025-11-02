import neo4j, { Driver, Session } from "neo4j-driver";
import { createVectorIndexes } from "./vector";

let driver: Driver | null = null;

/**
 * Get Neo4j driver instance (singleton pattern)
 */
export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "password";

    if (!process.env.NEO4J_URI) {
      console.warn(
        "NEO4J_URI not set, using default: bolt://localhost:7687"
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  return driver;
}

/**
 * Get a Neo4j session
 */
export function getSession(): Session {
  return getDriver().session();
}

/**
 * Close the Neo4j driver connection
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Test Neo4j connection
 */
export async function testConnection(): Promise<boolean> {
  const session = getSession();
  try {
    await session.run("RETURN 1");
    return true;
  } catch (error) {
    console.error("Neo4j connection test failed:", error);
    return false;
  } finally {
    await session.close();
  }
}

/**
 * Initialize database schema (constraints and indexes)
 */
export async function initializeSchema(): Promise<void> {
  const session = getSession();

  try {
    // Create uniqueness constraints (these automatically create indexes)
    await session.run(`
      CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
      FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT segment_id_unique IF NOT EXISTS
      FOR (s:Segment) REQUIRE s.segment_id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT video_id_unique IF NOT EXISTS
      FOR (v:Video) REQUIRE v.video_id IS UNIQUE
    `);

    // Create additional indexes for performance
    await session.run(`
      CREATE INDEX concept_category_index IF NOT EXISTS
      FOR (c:Concept) ON (c.category)
    `);

    await session.run(`
      CREATE INDEX concept_total_mentions_index IF NOT EXISTS
      FOR (c:Concept) ON (c.total_mentions)
    `);

    await session.run(`
      CREATE INDEX concept_canonical_name_index IF NOT EXISTS
      FOR (c:Concept) ON (c.canonical_name)
    `);

    await session.run(`
      CREATE INDEX segment_video_id_index IF NOT EXISTS
      FOR (s:Segment) ON (s.video_id)
    `);

    console.log("Neo4j schema initialized successfully");
  } catch (error) {
    console.error("Failed to initialize schema:", error);
    throw error;
  } finally {
    await session.close();
  }

  // Initialize vector indexes (separate session)
  try {
    await createVectorIndexes();
  } catch (error) {
    console.error("Failed to initialize vector indexes:", error);
    // Don't throw - vector indexes are optional for basic functionality
  }
}
