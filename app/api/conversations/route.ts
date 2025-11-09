import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-context";
import { getConversationsForWorkspace } from "@/lib/db/conversations";

/**
 * GET /api/conversations
 *
 * List all conversations for the current workspace
 * Query params: ?limit=50
 * Automatically scoped to the workspace specified in X-Workspace header or query param
 */
export const GET = withWorkspace(async (request: NextRequest) => {
  try {
    const workspace = request.headers.get("X-Workspace") || "default";
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const conversations = await getConversationsForWorkspace(workspace, limit);

    return NextResponse.json({
      success: true,
      conversations: conversations.map((c) => ({
        id: c.id,
        workspace: c.workspace,
        title: c.title || "Untitled Conversation",
        created_at: c.created_at,
        updated_at: c.updated_at,
        last_message_at: c.last_message_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch conversations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
