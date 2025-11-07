import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/neo4j/client";

/**
 * GET /api/debug-videos
 *
 * Debug endpoint to check ALL video nodes
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSession();

    const results: any = {
      timestamp: new Date().toISOString(),
    };

    try {
      // Check ALL videos (regardless of workspace)
      const allVideos = await session.run(
        `MATCH (v:Video)
         RETURN v.video_id as video_id,
                v.url as url,
                v.workspace as workspace,
                v.created_at as created_at
         ORDER BY v.video_id
         LIMIT 50`
      );
      results.allVideos = {
        count: allVideos.records.length,
        videos: allVideos.records.map(r => ({
          video_id: r.get('video_id'),
          url: r.get('url'),
          workspace: r.get('workspace'),
          created_at: r.get('created_at') ? r.get('created_at').toString() : null
        }))
      };

      // Check videos WITHOUT workspace property
      const videosWithoutWorkspace = await session.run(
        `MATCH (v:Video)
         WHERE v.workspace IS NULL
         RETURN count(v) as count`
      );
      results.videosWithoutWorkspace = videosWithoutWorkspace.records[0].get('count').toNumber();

      // Check which segments link to videos without workspace
      if (results.videosWithoutWorkspace > 0) {
        const linkedSegments = await session.run(
          `MATCH (s:Segment)-[:FROM_VIDEO]->(v:Video)
           WHERE v.workspace IS NULL AND s.workspace IS NOT NULL
           RETURN s.workspace as segment_workspace,
                  v.video_id as video_id,
                  count(s) as segment_count
           ORDER BY segment_workspace, video_id
           LIMIT 20`
        );
        results.segmentsLinkingToVideosWithoutWorkspace = linkedSegments.records.map(r => ({
          segment_workspace: r.get('segment_workspace'),
          video_id: r.get('video_id'),
          segment_count: r.get('segment_count').toNumber()
        }));
      }

    } finally {
      await session.close();
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error in debug-videos endpoint:", error);

    return NextResponse.json(
      {
        error: "Failed to debug videos",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
