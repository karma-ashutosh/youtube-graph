/**
 * CLI Script: Create a new workspace
 *
 * Usage: npx tsx scripts/create-workspace.ts <workspace_name>
 * Example: npx tsx scripts/create-workspace.ts health
 */

import { createWorkspace, initializeSchema } from '../lib/neo4j/client';
import { runWithWorkspaceAsync, isValidWorkspace } from '../lib/workspace-context';

async function main() {
  const workspaceName = process.argv[2];

  if (!workspaceName) {
    console.error('❌ Error: Workspace name is required');
    console.log('\nUsage: npx tsx scripts/create-workspace.ts <workspace_name>');
    console.log('Example: npx tsx scripts/create-workspace.ts health\n');
    process.exit(1);
  }

  if (!isValidWorkspace(workspaceName)) {
    console.error('❌ Error: Invalid workspace name');
    console.log('Workspace names can only contain lowercase letters, numbers, and underscores\n');
    process.exit(1);
  }

  try {
    console.log(`🔧 Creating workspace: ${workspaceName}...`);
    await createWorkspace(workspaceName);
    console.log('✅ Workspace database created\n');

    console.log('🔧 Initializing schema...');
    await runWithWorkspaceAsync(workspaceName, async () => {
      await initializeSchema();
    });
    console.log('✅ Schema initialized\n');

    console.log(`🎉 Workspace "${workspaceName}" created successfully!`);
    console.log('\n💡 To use this workspace:');
    console.log(`   - UI: Select "${workspaceName}" from the workspace dropdown`);
    console.log(`   - API: Add header X-Workspace: ${workspaceName}`);
    console.log(`   - API: Or add query param ?workspace=${workspaceName}\n`);

  } catch (error: any) {
    console.error('❌ Failed to create workspace:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
