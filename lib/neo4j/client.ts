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
 *
 * Note: In Community Edition, we use a single database with workspace properties
 * instead of separate databases (which requires Enterprise Edition)
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
 * List all available workspaces
 * In Community Edition, we track workspaces by finding distinct workspace properties
 */
export async function listWorkspaces(): Promise<string[]> {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n)
      WHERE n.workspace IS NOT NULL
      RETURN DISTINCT n.workspace as workspace
      ORDER BY workspace
    `);
    const workspaces = result.records.map(r => r.get('workspace') as string);

    // Always include 'default' workspace
    if (!workspaces.includes('default')) {
      workspaces.unshift('default');
    }

    return workspaces;
  } finally {
    await session.close();
  }
}

/**
 * Create a new workspace
 * In Community Edition, workspaces are logical - we create a marker node
 * so the workspace appears in the list even before any data is added.
 */
export async function createWorkspace(workspace: string): Promise<void> {
  const session = getSession();
  try {
    // Create a marker node so the workspace appears in listWorkspaces()
    await session.run(`
      MERGE (w:WorkspaceMarker {workspace: $workspace, name: $workspace})
      ON CREATE SET w.created_at = datetime()
      RETURN w
    `, { workspace });
    console.log(`Workspace '${workspace}' is ready for use`);
  } finally {
    await session.close();
  }
}

/**
 * Delete a workspace
 * Removes all nodes and relationships associated with this workspace
 * Cannot delete the default workspace
 */
export async function deleteWorkspace(workspace: string): Promise<void> {
  if (workspace === 'default') {
    throw new Error('Cannot delete default workspace');
  }

  const session = getSession();
  try {
    // Delete all nodes with this workspace (including the marker) in batches
    let deletedCount = 0;
    let batchCount = 0;
    do {
      const result = await session.run(`
        MATCH (n {workspace: $workspace})
        WITH n LIMIT 10000
        DETACH DELETE n
        RETURN count(n) as deleted
      `, { workspace });
      deletedCount = result.records[0]?.get('deleted')?.toNumber() || 0;
      batchCount++;
    } while (deletedCount > 0 && batchCount < 100); // Safety limit

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
