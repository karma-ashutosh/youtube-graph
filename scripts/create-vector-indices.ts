/**
 * Migration Script: Create workspace-specific vector indices for existing workspaces
 *
 * This script creates vector indices for workspaces that have data but are missing the indices.
 * Run this for workspaces that were created before vector indices were added.
 *
 * Run with: npx tsx scripts/create-vector-indices.ts [workspace_name]
 */

import * as dotenv from 'dotenv';
import { createVectorIndexes } from '../lib/neo4j/vector';
import { runWithWorkspaceAsync } from '../lib/workspace-context';
import { getDriver } from '../lib/neo4j/client';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const targetWorkspace = process.argv[2] || 'micro_conf';

async function createIndices() {
  console.log(`🔄 Creating vector indices for workspace: ${targetWorkspace}...\n`);

  const driver = getDriver();
  const session = driver.session();

  try {
    // Check existing indices
    console.log('📋 Checking existing vector indices...');
    const indicesResult = await session.run(`
      SHOW INDEXES
      YIELD name, type
      WHERE type = 'VECTOR'
      RETURN name, type
    `);

    console.log('\nExisting vector indices:');
    for (const record of indicesResult.records) {
      console.log(`  - ${record.get('name')} (${record.get('type')})`);
    }

    // Check if workspace has data with embeddings
    console.log(`\n📊 Checking data in workspace '${targetWorkspace}'...`);
    const conceptsResult = await session.run(`
      MATCH (c:Concept {workspace: $workspace})
      WHERE c.embedding IS NOT NULL
      RETURN count(c) as count
    `, { workspace: targetWorkspace });

    const segmentsResult = await session.run(`
      MATCH (s:Segment {workspace: $workspace})
      WHERE s.embedding IS NOT NULL
      RETURN count(s) as count
    `, { workspace: targetWorkspace });

    const conceptCount = conceptsResult.records[0]?.get('count').toNumber() || 0;
    const segmentCount = segmentsResult.records[0]?.get('count').toNumber() || 0;

    console.log(`  - Concepts with embeddings: ${conceptCount}`);
    console.log(`  - Segments with embeddings: ${segmentCount}`);

    if (conceptCount === 0 && segmentCount === 0) {
      console.log('\n⚠️  No data with embeddings found in this workspace');
      console.log('   Make sure you have run the backfill endpoint first');
      return;
    }

    // Create vector indices for the workspace
    console.log(`\n🔧 Creating vector indices for workspace '${targetWorkspace}'...`);
    await runWithWorkspaceAsync(targetWorkspace, async () => {
      await createVectorIndexes();
    });

    console.log('\n✨ Vector indices created successfully!');
    console.log(`\n💡 Workspace '${targetWorkspace}' is now ready for semantic search`);
    console.log('   You can use the chat feature with this workspace\n');

  } catch (error) {
    console.error('❌ Failed to create indices:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run script
createIndices()
  .then(() => {
    console.log('🎉 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
