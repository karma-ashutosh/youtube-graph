import { NextRequest, NextResponse } from "next/server";
import { getGraphData } from "@/lib/neo4j/queries";

/**
 * GET /api/graph
 *
 * Returns graph data for visualization
 * Query params:
 * - minMentions: minimum number of mentions to include a concept
 * - category: filter by category
 * - limit: maximum number of nodes to return
 * - includeSegments: whether to include segment nodes (true/false)
 * - roleFilter: filter by role (all/primary/supporting/mentioned)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minMentions = searchParams.get("minMentions");
    const category = searchParams.get("category");
    const limit = searchParams.get("limit");
    const includeSegments = searchParams.get("includeSegments");
    const roleFilter = searchParams.get("roleFilter");

    const graphData = await getGraphData({
      minMentions: minMentions ? parseInt(minMentions) : undefined,
      category: category || undefined,
      limit: limit ? parseInt(limit) : undefined,
      includeSegments: includeSegments === "true",
      roleFilter: roleFilter || undefined,
    });

    return NextResponse.json({
      success: true,
      ...graphData,
    });
  } catch (error) {
    console.error("Error fetching graph data:", error);

    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}
