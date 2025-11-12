import { NextRequest, NextResponse } from "next/server";
import { answerQuestion, ConversationMessage } from "@/lib/ai/chat";
import { withWorkspace } from "@/lib/workspace-context";
import {
  createConversation,
  addMessage,
  getMessages,
  generateConversationTitle,
} from "@/lib/db/conversations";
import { rewriteQueryWithContext } from "@/lib/rag/query-rewriter";

/**
 * POST /api/chat
 *
 * Chat endpoint for RAG-powered Q&A with conversation history support
 * Request body: { question: string, conversationId?: string }
 * Response: { answer: string, conversationId: string, sources: { concepts: [], segments: [] } }
 * Automatically scoped to the workspace specified in X-Workspace header or query param
 */
export const POST = withWorkspace(async (request: NextRequest) => {
  try {
    const { question, conversationId } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required and must be a string" },
        { status: 400 }
      );
    }

    if (question.trim().length === 0) {
      return NextResponse.json(
        { error: "Question cannot be empty" },
        { status: 400 }
      );
    }

    console.log(`Chat question: "${question}"`);

    // Get or create conversation
    const workspace = request.headers.get("X-Workspace") || "default";
    let convId = conversationId;
    let conversationHistory: ConversationMessage[] = [];

    if (!convId) {
      // Create new conversation
      convId = await createConversation(workspace);
      console.log(`Created new conversation: ${convId}`);
    } else {
      // Load existing conversation history
      const messages = await getMessages(convId);
      conversationHistory = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      console.log(`Loaded ${conversationHistory.length} messages from conversation ${convId}`);
    }

    // Save user message
    await addMessage(convId, "user", question);

    // Rewrite query with context if needed (for better RAG search)
    let searchQuery = question;
    if (conversationHistory.length > 0) {
      try {
        searchQuery = await rewriteQueryWithContext(question, await getMessages(convId));
        console.log(`Rewritten query: "${searchQuery}"`);
      } catch (error) {
        console.error("Query rewriting failed, using original query:", error);
        // Continue with original query if rewriting fails
      }
    }

    // Generate answer using RAG with conversation history
    const response = await answerQuestion(searchQuery, conversationHistory);

    // Save assistant message with sources
    await addMessage(convId, "assistant", response.answer, {
      concepts: response.sources.concepts,
      segments: response.sources.segments,
    });

    // Generate title after first exchange
    if (conversationHistory.length === 0) {
      await generateConversationTitle(convId);
    }

    return NextResponse.json({
      success: true,
      answer: response.answer,
      conversationId: convId,
      sources: {
        concepts: response.sources.concepts.map((c) => ({
          concept_id: c.concept_id,
          canonical_name: c.canonical_name,
          aliases: c.aliases,
          category: c.category,
          total_mentions: c.total_mentions,
          similarity: c.similarity,
        })),
        segments: response.sources.segments.map((s) => ({
          segment_id: s.segment_id,
          topic_hint: s.topic_hint,
          start_time: s.start_time,
          end_time: s.end_time,
          transcript: s.transcript.slice(0, 500), // Limit transcript length
          similarity: s.similarity,
          video_url: s.video_url,
          video_title: s.video_title,
          concepts: s.concepts,
        })),
      },
      relatedTopics: response.relatedTopics?.map((r) => ({
        segment_id: r.segment_id,
        topic_hint: r.topic_hint,
        similarity_score: r.similarity_score,
        shared_concept_count: r.shared_concept_count,
        connecting_concepts: r.connecting_concepts,
        preview: r.preview,
      })) || [],
    });
  } catch (error) {
    console.error("Chat error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
