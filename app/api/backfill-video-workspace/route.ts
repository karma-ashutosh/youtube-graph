import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/neo4j/client";

/**
 * POST /api/backfill-video-workspace
 *
 * Backfills workspace property on Video nodes based on their linked Segments
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSession();
    let totalUpdated = 0;

    try {
      // Find videos without workspace and set them based on their linked segments
      const result = await session.run(
        `MATCH (v:Video)
         WHERE v.workspace IS NULL
         MATCH (s:Segment)-[:FROM_VIDEO]->(v)
         WHERE s.workspace IS NOT NULL
         WITH v, s.workspace as workspace, count(s) as segment_count
         ORDER BY segment_count DESC
         WITH v, collect({workspace: workspace, count: segment_count})[0] as primary_workspace
         SET v.workspace = primary_workspace.workspace
         RETURN v.video_id as video_id, v.workspace as workspace, primary_workspace.count as segment_count`
      );

      totalUpdated = result.records.length;

      const updates = result.records.map(r => ({
        video_id: r.get('video_id'),
        workspace: r.get('workspace'),
        segment_count: r.get('segment_count').toNumber()
      }));

      return NextResponse.json({
        success: true,
        message: `Updated ${totalUpdated} videos with workspace property`,
        updates
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error("Error in backfill endpoint:", error);

    return NextResponse.json(
      {
        error: "Failed to backfill video workspace",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
