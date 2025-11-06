import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'processing') as processing
         FROM batch_segments
         WHERE batch_id = $1`,
        [batchId]
      );

      const stats = result.rows[0];
      const total = parseInt(stats.total);
      const completed = parseInt(stats.completed);
      const failed = parseInt(stats.failed);
      const pending = parseInt(stats.pending);
      const processing = parseInt(stats.processing);

      if (total === 0) {
        return NextResponse.json(
          { success: false, error: "Batch not found" },
          { status: 404 }
        );
      }

      const isDone = pending === 0 && processing === 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Get failed segments details
      const failedResult = await client.query(
        `SELECT segment_index, error
         FROM batch_segments
         WHERE batch_id = $1 AND status = 'failed'
         ORDER BY segment_index`,
        [batchId]
      );

      return NextResponse.json({
        success: true,
        batchId,
        total,
        completed,
        failed,
        pending,
        processing,
        progress,
        isDone,
        errors: failedResult.rows
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Batch status error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
