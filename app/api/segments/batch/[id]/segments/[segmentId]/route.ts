import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ingestSegment } from "@/lib/utils/ingest";
import { withWorkspace } from "@/lib/workspace-context";

export const POST = withWorkspace(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; segmentId: string }> }
) => {
  try {
    const { id: batchId, segmentId } = await params;
    const client = await pool.connect();

    try {
      // Get segment data
      const result = await client.query(
        `SELECT id, segment_data FROM batch_segments WHERE id = $1 AND batch_id = $2`,
        [segmentId, batchId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Segment not found" },
          { status: 404 }
        );
      }

      const row = result.rows[0];

      // Update to processing
      await client.query(
        `UPDATE batch_segments SET status = 'processing' WHERE id = $1`,
        [row.id]
      );

      try {
        // Process the segment
        const result = await ingestSegment(row.segment_data);

        if (!result.success) {
          throw new Error(result.error || "Segment processing failed");
        }

        // Update to completed
        await client.query(
          `UPDATE batch_segments
           SET status = 'completed', processed_at = NOW(), error = NULL
           WHERE id = $1`,
          [row.id]
        );

        return NextResponse.json({
          success: true,
          message: "Segment processed successfully"
        });
      } catch (error: any) {
        // Mark as failed
        await client.query(
          `UPDATE batch_segments
           SET status = 'failed', processed_at = NOW(), error = $2
           WHERE id = $1`,
          [row.id, error.message]
        );

        return NextResponse.json({
          success: false,
          error: error.message
        });
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Process segment error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});
