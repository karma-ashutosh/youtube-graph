import { NextResponse } from "next/server";
import { createVectorIndexes } from "@/lib/neo4j/vector";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * POST /api/init-indices
 *
 * Initialize vector indices for the current workspace
 * This is useful for existing workspaces that were created before vector indices were added
 */
export const POST = withWorkspace(async () => {
  try {
    await createVectorIndexes();

    return NextResponse.json({
      success: true,
      message: "Vector indices initialized successfully for current workspace",
    });
  } catch (error) {
    console.error("Error initializing vector indices:", error);

    return NextResponse.json(
      {
        error: "Failed to initialize vector indices",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/init-indices
 *
 * Check if vector indices exist for the current workspace
 */
export const GET = withWorkspace(async () => {
  try {
    const { getCurrentWorkspace } = await import("@/lib/workspace-context");
    const { getSession } = await import("@/lib/neo4j/client");
    const workspace = getCurrentWorkspace();
    const session = getSession();

    try {
      // Check if indices exist
      // Note: Indices are shared across workspaces, not workspace-specific
      const result = await session.run(`
        SHOW INDEXES
        YIELD name, type
        WHERE name IN ['concept_embeddings', 'segment_embeddings']
        RETURN name, type
      `);

      const indices = result.records.map(r => ({
        name: r.get('name'),
        type: r.get('type'),
      }));

      const hasConceptIndex = indices.some(i => i.name === 'concept_embeddings');
      const hasSegmentIndex = indices.some(i => i.name === 'segment_embeddings');

      return NextResponse.json({
        success: true,
        workspace,
        indices: {
          concept: hasConceptIndex,
          segment: hasSegmentIndex,
          all: hasConceptIndex && hasSegmentIndex,
        },
        details: indices,
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error("Error checking indices:", error);

    return NextResponse.json(
      {
        error: "Failed to check indices",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
