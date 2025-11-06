import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ingestSegment } from "@/lib/utils/ingest";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = params.id;
    const client = await pool.connect();

    try {
      // Reset failed segments to pending
      await client.query(
        `UPDATE batch_segments
         SET status = 'pending', error = NULL
         WHERE batch_id = $1 AND status = 'failed'`,
        [batchId]
      );

      // Start async processing (don't await)
      processFailedSegments(batchId).catch(err =>
        console.error(`Batch ${batchId} retry error:`, err)
      );

      return NextResponse.json({
        success: true,
        message: "Retry started for failed segments"
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Batch retry error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function processFailedSegments(batchId: string) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, segment_index, segment_data
       FROM batch_segments
       WHERE batch_id = $1 AND status = 'pending'
       ORDER BY segment_index`,
      [batchId]
    );

    for (const row of result.rows) {
      try {
        await client.query(
          `UPDATE batch_segments SET status = 'processing' WHERE id = $1`,
          [row.id]
        );

        const segmentData = row.segment_data;
        await ingestSegment(segmentData);

        await client.query(
          `UPDATE batch_segments
           SET status = 'completed', processed_at = NOW(), error = NULL
           WHERE id = $1`,
          [row.id]
        );
      } catch (error: any) {
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
}
