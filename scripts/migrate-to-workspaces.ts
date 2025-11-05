/**
 * Migration Script: Migrate from single database to workspace-based architecture
 *
 * This script:
 * 1. Creates the 'workspace_default' database
 * 2. Initializes the schema for the default workspace
 * 3. Notes that existing data in the 'neo4j' database remains accessible
 *
 * Run with: npx tsx scripts/migrate-to-workspaces.ts
 */

import { createWorkspace, initializeSchema, listWorkspaces } from '../lib/neo4j/client';
import { runWithWorkspaceAsync } from '../lib/workspace-context';

async function migrate() {
  console.log('🔄 Starting migration to workspace-based architecture...\n');

  try {
    // Check existing workspaces
    console.log('📋 Checking existing workspaces...');
    const workspaces = await listWorkspaces();
    console.log(`Found ${workspaces.length} workspace(s): ${workspaces.join(', ')}\n`);

    // Create default workspace if it doesn't exist
    if (!workspaces.includes('default')) {
      console.log('➕ Creating default workspace...');
      await createWorkspace('default');
      console.log('✅ Default workspace created\n');
    } else {
      console.log('✅ Default workspace already exists\n');
    }

    // Initialize schema for default workspace
    console.log('🔧 Initializing schema for default workspace...');
    await runWithWorkspaceAsync('default', async () => {
      await initializeSchema();
    });
    console.log('✅ Schema initialized for default workspace\n');

    console.log('✨ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Existing data in the "neo4j" database is still accessible');
    console.log('   2. To use the new workspace system, ingest new data with workspace headers');
    console.log('   3. Create additional workspaces via the UI (/workspaces) or API');
    console.log('   4. Update API calls to include X-Workspace header or workspace query param\n');
    console.log('💡 Note: If you have existing data, you may want to migrate it to the default workspace');
    console.log('   by copying nodes and relationships from the "neo4j" database to "workspace_default"\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
