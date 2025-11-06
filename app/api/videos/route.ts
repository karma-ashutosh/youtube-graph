import { NextResponse } from "next/server";
import { getAllVideos } from "@/lib/neo4j/queries";
import { withWorkspace } from "@/lib/workspace-context";

/**
 * GET /api/videos
 *
 * Returns all videos in the knowledge graph
 * Automatically scoped to the workspace specified in X-Workspace header or query param
 */
export const GET = withWorkspace(async () => {
  try {
    const videos = await getAllVideos();
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
});
