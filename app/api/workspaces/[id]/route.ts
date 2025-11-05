import { NextRequest, NextResponse } from 'next/server';
import { deleteWorkspace } from '@/lib/neo4j/client';

/**
 * DELETE /api/workspaces/[id]
 * Delete a workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspace = params.id;

    if (workspace === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete the default workspace' },
        { status: 400 }
      );
    }

    await deleteWorkspace(workspace);

    return NextResponse.json({
      success: true,
      message: `Workspace '${workspace}' deleted successfully`
    });
  } catch (error: any) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete workspace' },
      { status: 400 }
    );
  }
}
