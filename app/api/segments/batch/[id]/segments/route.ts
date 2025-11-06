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
        `SELECT id, segment_index, status, error, processed_at, segment_data
         FROM batch_segments
         WHERE batch_id = $1
         ORDER BY segment_index`,
        [batchId]
      );

      return NextResponse.json({
        success: true,
        segments: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Fetch segments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
