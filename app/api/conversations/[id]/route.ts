import { NextRequest, NextResponse } from "next/server";
import { getConversation, getMessages, getMessageCount } from "@/lib/db/conversations";

/**
 * GET /api/conversations/[id]
 *
 * Get a specific conversation with all its messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Get conversation
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await getMessages(conversationId);

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        workspace: conversation.workspace,
        title: conversation.title || "Untitled Conversation",
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        last_message_at: conversation.last_message_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch conversation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
