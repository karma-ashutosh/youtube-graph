import { NextRequest, NextResponse } from "next/server";
import { getSegmentById } from "@/lib/neo4j/queries";

/**
 * GET /api/segments/[id]
 *
 * Returns detailed information about a specific segment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: segmentId } = await params;

    const segmentData = await getSegmentById(segmentId);

    if (!segmentData) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...segmentData,
    });
  } catch (error) {
    console.error("Error fetching segment:", error);

    return NextResponse.json(
      { error: "Failed to fetch segment" },
      { status: 500 }
    );
  }
}
