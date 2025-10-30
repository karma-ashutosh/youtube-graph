import { NextResponse } from "next/server";
import { getAllSegments } from "@/lib/neo4j/queries";

/**
 * GET /api/segments
 *
 * Returns all segments in the knowledge graph
 */
export async function GET() {
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
}
