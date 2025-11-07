import { NextRequest, NextResponse } from "next/server";
import { SegmentBatchSchema } from "@/lib/utils/validators";
import { ingestSegmentsBatch } from "@/lib/utils/ingest";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * POST /api/segments/ingest
 *
 * Ingests a batch of segment data into the knowledge graph
 * Uses workspace context from request headers/query params
 *
 * Body: Array of SegmentData objects
 */
export const POST = withWorkspace(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Validate input
    const segments = SegmentBatchSchema.parse(body);

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No segments provided" },
        { status: 400 }
      );
    }

    // Process segments
    const results = await ingestSegmentsBatch(segments);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error in segment ingestion:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
