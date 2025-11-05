import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaces, createWorkspace } from '@/lib/neo4j/client';
import { isValidWorkspace, runWithWorkspaceAsync } from '@/lib/workspace-context';

/**
 * GET /api/workspaces
 * List all available workspaces
 */
export async function GET() {
  try {
    const workspaces = await listWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace
 * Body: { workspace: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { workspace } = await request.json();

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    if (!isValidWorkspace(workspace)) {
      return NextResponse.json(
        { error: 'Invalid workspace name. Only lowercase alphanumeric and underscores allowed.' },
        { status: 400 }
      );
    }

    await createWorkspace(workspace);

    // Initialize schema for the new workspace
    const { initializeSchema } = await import('@/lib/neo4j/client');
    await runWithWorkspaceAsync(workspace, async () => {
      await initializeSchema();
    });

    return NextResponse.json({
      success: true,
      workspace,
      message: `Workspace '${workspace}' created successfully`
    });
  } catch (error: any) {
    console.error('Failed to create workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create workspace' },
      { status: 400 }
    );
  }
}
