import { NextRequest, NextResponse } from "next/server";
import { getConceptById } from "@/lib/neo4j/queries";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * GET /api/concepts/[id]
 *
 * Returns detailed information about a specific concept
 * Uses workspace context from request headers/query params
 */
export const GET = withWorkspace(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: conceptId } = await params;

    const conceptData = await getConceptById(conceptId);

    if (!conceptData) {
      return NextResponse.json(
        { error: "Concept not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...conceptData,
    });
  } catch (error) {
    console.error("Error fetching concept:", error);

    return NextResponse.json(
      { error: "Failed to fetch concept" },
      { status: 500 }
    );
  }
});
