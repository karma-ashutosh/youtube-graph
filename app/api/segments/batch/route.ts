import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import pool from "@/lib/db";
import { SegmentBatchSchema } from "@/lib/utils/validators";
import { ingestSegment } from "@/lib/utils/ingest";
import { withWorkspace, getCurrentWorkspace, runWithWorkspaceAsync } from "@/lib/workspace-context";

export const POST = withWorkspace(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const segments = SegmentBatchSchema.parse(body);

    const batchId = randomUUID();
    const client = await pool.connect();

    try {
      // Insert all segments with 'pending' status
      await client.query('BEGIN');

      for (let i = 0; i < segments.length; i++) {
        await client.query(
          `INSERT INTO batch_segments (batch_id, segment_index, segment_data, status)
           VALUES ($1, $2, $3, $4)`,
          [batchId, i, JSON.stringify(segments[i]), 'pending']
        );
      }

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Capture current workspace for background processing
    const workspace = getCurrentWorkspace();

    // Start async processing (don't await)
    processSegmentsBatch(batchId, workspace).catch(err =>
      console.error(`Batch ${batchId} processing error:`, err)
    );

    return NextResponse.json({
      success: true,
      batchId,
      totalSegments: segments.length,
      message: "Batch created and processing started"
    });
  } catch (error: any) {
    console.error("Batch creation error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
});

async function processSegmentsBatch(batchId: string, workspace: string) {
  // Run all processing within the workspace context
  return runWithWorkspaceAsync(workspace, async () => {
    const client = await pool.connect();

    try {
      // Get all pending segments
      const result = await client.query(
        `SELECT id, segment_index, segment_data
         FROM batch_segments
         WHERE batch_id = $1 AND status = 'pending'
         ORDER BY segment_index`,
        [batchId]
      );

      for (const row of result.rows) {
        try {
          // Update to processing
          await client.query(
            `UPDATE batch_segments SET status = 'processing' WHERE id = $1`,
            [row.id]
          );

          // Process the segment
          const segmentData = row.segment_data;
          const result = await ingestSegment(segmentData);

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
        } catch (error: any) {
          // Mark as failed with error
          await client.query(
            `UPDATE batch_segments
             SET status = 'failed', processed_at = NOW(), error = $2
             WHERE id = $1`,
            [row.id, error.message]
          );
        }
      }
    } finally {
      client.release();
    }
  });
}
