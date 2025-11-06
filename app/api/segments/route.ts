import { NextResponse } from "next/server";
import { getAllSegments } from "@/lib/neo4j/queries";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * GET /api/segments
 *
 * Returns all segments in the knowledge graph
 * Automatically scoped to the workspace specified in X-Workspace header or query param
 */
export const GET = withWorkspace(async () => {
  try {
    const segments = await getAllSegments();

    return NextResponse.json({
      success: true,
      total: segments.length,
      segments,
    });
  } catch (error) {
    console.error("Error fetching segments:", error);

    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 }
    );
  }
});
