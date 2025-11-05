import { NextResponse } from "next/server";
import { getAllConceptsWithRoles } from "@/lib/neo4j/queries";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * GET /api/concepts
 *
 * Returns all concepts in the knowledge graph with role statistics
 * Automatically scoped to the workspace specified in X-Workspace header or query param
 */
export const GET = withWorkspace(async () => {
  try {
    const concepts = await getAllConceptsWithRoles();

    return NextResponse.json({
      success: true,
      total: concepts.length,
      concepts,
    });
  } catch (error) {
    console.error("Error fetching concepts:", error);

    return NextResponse.json(
      { error: "Failed to fetch concepts" },
      { status: 500 }
    );
  }
});
