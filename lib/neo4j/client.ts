import neo4j, { Driver, Session } from "neo4j-driver";
import { createVectorIndexes } from "./vector";
import { getCurrentWorkspace } from "../workspace-context";

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
 * Get a Neo4j session scoped to the current workspace
 * The workspace is retrieved from the async context set by the middleware
 */
export function getSession(): Session {
  const workspace = getCurrentWorkspace();
  return getDriver().session({
    database: `workspace_${workspace}`,
  });
}

/**
 * Get a Neo4j session for the system database (for workspace management)
 */
export function getSystemSession(): Session {
  return getDriver().session({ database: 'system' });
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
 * List all available workspaces
 */
export async function listWorkspaces(): Promise<string[]> {
  const session = getSystemSession();
  try {
    const result = await session.run('SHOW DATABASES');
    return result.records
      .map(r => r.get('name') as string)
      .filter(name => name.startsWith('workspace_'))
      .map(name => name.replace('workspace_', ''));
  } finally {
    await session.close();
  }
}

/**
 * Create a new workspace (database)
 */
export async function createWorkspace(workspace: string): Promise<void> {
  const session = getSystemSession();
  try {
    await session.run(`CREATE DATABASE workspace_${workspace} IF NOT EXISTS`);
    console.log(`Workspace '${workspace}' created successfully`);
  } finally {
    await session.close();
  }
}

/**
 * Delete a workspace (database)
 * Cannot delete the default workspace
 */
export async function deleteWorkspace(workspace: string): Promise<void> {
  if (workspace === 'default') {
    throw new Error('Cannot delete default workspace');
  }

  const session = getSystemSession();
  try {
    await session.run(`DROP DATABASE workspace_${workspace} IF EXISTS`);
    console.log(`Workspace '${workspace}' deleted successfully`);
  } finally {
    await session.close();
  }
}

/**
 * Initialize database schema (constraints and indexes) for the current workspace
 * Note: This uses the workspace from the current async context
 */
export async function initializeSchema(): Promise<void> {
  const workspace = getCurrentWorkspace();
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

    console.log(`Neo4j schema initialized successfully for workspace '${workspace}'`);
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
