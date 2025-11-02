import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/chat";

/**
 * POST /api/chat
 *
 * Chat endpoint for RAG-powered Q&A
 * Request body: { question: string }
 * Response: { answer: string, sources: { concepts: [], segments: [] } }
 */
export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

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

    // Generate answer using RAG
    const response = await answerQuestion(question);

    return NextResponse.json({
      success: true,
      answer: response.answer,
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
}
