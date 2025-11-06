/**
 * Migration Script: Add workspace property to existing nodes (Community Edition)
 *
 * This script adds the workspace property to all existing nodes that don't have one,
 * assigning them to a specified workspace (default: 'micro_conf')
 *
 * Run with: npx tsx scripts/migrate-data-to-workspace.ts [workspace_name]
 */

import * as dotenv from 'dotenv';
import { getDriver } from '../lib/neo4j/client';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const targetWorkspace = process.argv[2] || 'micro_conf';

async function migrateData() {
  console.log(`🔄 Starting migration to workspace: ${targetWorkspace}...\n`);

  const driver = getDriver();
  const session = driver.session();

  try {
    // Count nodes without workspace
    console.log('📊 Analyzing existing data...');
    const countResult = await session.run(`
      MATCH (n)
      WHERE n.workspace IS NULL
      WITH labels(n) as node_labels, count(n) as count
      RETURN node_labels, count
      ORDER BY count DESC
    `);

    console.log('\nNodes without workspace property:');
    let totalNodes = 0;
    for (const record of countResult.records) {
      const labels = record.get('node_labels');
      const count = record.get('count').toNumber();
      totalNodes += count;
      console.log(`  - ${labels.join(':')}: ${count}`);
    }
    console.log(`  Total: ${totalNodes}\n`);

    if (totalNodes === 0) {
      console.log('✅ No nodes need migration!\n');
      return;
    }

    // Update Video nodes
    console.log('🎬 Migrating Video nodes...');
    const videoResult = await session.run(`
      MATCH (v:Video)
      WHERE v.workspace IS NULL
      SET v.workspace = $workspace
      RETURN count(v) as count
    `, { workspace: targetWorkspace });
    console.log(`✅ Migrated ${videoResult.records[0].get('count').toNumber()} Video nodes\n`);

    // Update Segment nodes
    console.log('📝 Migrating Segment nodes...');
    const segmentResult = await session.run(`
      MATCH (s:Segment)
      WHERE s.workspace IS NULL
      SET s.workspace = $workspace
      RETURN count(s) as count
    `, { workspace: targetWorkspace });
    console.log(`✅ Migrated ${segmentResult.records[0].get('count').toNumber()} Segment nodes\n`);

    // Update Concept nodes
    console.log('💡 Migrating Concept nodes...');
    const conceptResult = await session.run(`
      MATCH (c:Concept)
      WHERE c.workspace IS NULL
      SET c.workspace = $workspace
      RETURN count(c) as count
    `, { workspace: targetWorkspace });
    console.log(`✅ Migrated ${conceptResult.records[0].get('count').toNumber()} Concept nodes\n`);

    // Update Example nodes
    console.log('📌 Migrating Example nodes...');
    const exampleResult = await session.run(`
      MATCH (e:Example)
      WHERE e.workspace IS NULL
      SET e.workspace = $workspace
      RETURN count(e) as count
    `, { workspace: targetWorkspace });
    console.log(`✅ Migrated ${exampleResult.records[0].get('count').toNumber()} Example nodes\n`);

    // Update KeyIdea nodes
    console.log('🔑 Migrating KeyIdea nodes...');
    const keyIdeaResult = await session.run(`
      MATCH (ki:KeyIdea)
      WHERE ki.workspace IS NULL
      SET ki.workspace = $workspace
      RETURN count(ki) as count
    `, { workspace: targetWorkspace });
    console.log(`✅ Migrated ${keyIdeaResult.records[0].get('count').toNumber()} KeyIdea nodes\n`);

    // Create WorkspaceMarker
    console.log('🏷️  Creating workspace marker...');
    await session.run(`
      MERGE (w:WorkspaceMarker {workspace: $workspace, name: $workspace})
      ON CREATE SET w.created_at = datetime()
      RETURN w
    `, { workspace: targetWorkspace });
    console.log(`✅ WorkspaceMarker created for '${targetWorkspace}'\n`);

    // Show final counts
    console.log('📊 Final workspace statistics:');
    const statsResult = await session.run(`
      MATCH (n {workspace: $workspace})
      WITH labels(n)[0] as node_type, count(n) as count
      RETURN node_type, count
      ORDER BY node_type
    `, { workspace: targetWorkspace });

    for (const record of statsResult.records) {
      const nodeType = record.get('node_type');
      const count = record.get('count').toNumber();
      console.log(`  - ${nodeType}: ${count}`);
    }

    console.log('\n✨ Migration completed successfully!');
    console.log(`\n💡 All data has been migrated to workspace: ${targetWorkspace}`);
    console.log('   You can now switch to this workspace in the UI at /workspaces\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
