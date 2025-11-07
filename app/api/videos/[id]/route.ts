import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/neo4j/queries";
import { withWorkspace } from "@/lib/workspace-context";

export const GET = withWorkspace(async (
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) => {
  try {
    const params = await props.params;
    const videoId = params.id;
    const data = await getVideoById(videoId);

    if (!data) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
});
