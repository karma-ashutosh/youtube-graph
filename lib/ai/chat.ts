import { GoogleGenerativeAI } from "@google/generative-ai";
import { semanticSearch, SimilarConcept, SimilarSegment } from "../neo4j/vector";
import { debugLogger } from "../debug-logger";

const googleAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

export interface ChatResponse {
  answer: string;
  sources: {
    concepts: SimilarConcept[];
    segments: SimilarSegment[];
  };
}


/**
 * Build context string from knowledge graph results
 */
function buildContextFromGraph(
  results: {
    concepts: SimilarConcept[];
    segments: SimilarSegment[];
  },
  requestId: string
): string {
  const { concepts, segments } = results;

  debugLogger.log("buildContextFromGraph", "start", {
    requestId,
    conceptCount: concepts.length,
    segmentCount: segments.length,
  });

  let context = "";

  if (concepts.length > 0) {
    context += "Related Concepts from the Knowledge Graph:\n";
    concepts.forEach((c, i) => {
      context += `${i + 1}. ${c.canonical_name}`;
      if (c.aliases && c.aliases.length > 0) {
        context += ` (also known as: ${c.aliases.join(", ")})`;
      }
      context += ` - mentioned ${c.total_mentions} times\n`;
    });
    context += "\n";
  }

  if (segments.length > 0) {
    context += "Relevant Video Segments:\n\n";
    segments.forEach((s, i) => {
      context += `Segment ${i + 1}: "${s.topic_hint}"\n`;
      if (s.video_title) {
        context += `From video: ${s.video_title}\n`;
      }
      context += `Time: ${s.start_time} - ${s.end_time}\n`;

      // Include relevant concepts discussed
      if (s.concepts && s.concepts.length > 0) {
        const primaryConcepts = s.concepts.filter(c => c.role === "primary");
        if (primaryConcepts.length > 0) {
          context += `Key concepts: ${primaryConcepts.map(c => c.name).join(", ")}\n`;
        }
      }

      // Add transcript excerpt
      const excerpt = s.transcript.slice(0, 300);
      context += `Content: ${excerpt}${s.transcript.length > 300 ? "..." : ""}\n\n`;
    });
  }

  debugLogger.log("buildContextFromGraph", "complete", {
    requestId,
    contextLength: context.length,
  });

  return context;
}

/**
 * Generate answer with knowledge graph context (one-pass approach)
 */
async function generateAnswerWithContext(
  question: string,
  graphResults: { concepts: SimilarConcept[]; segments: SimilarSegment[] },
  requestId: string
): Promise<string> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  debugLogger.log("generateAnswerWithContext", "start", {
    requestId,
    questionLength: question.length,
    conceptCount: graphResults.concepts.length,
    segmentCount: graphResults.segments.length,
  });

  const context = buildContextFromGraph(graphResults, requestId);

  let prompt: string;

  if (!context) {
    debugLogger.log("generateAnswerWithContext", "no_context", {
      requestId,
      message: "No relevant context found, generating general answer",
    });
    prompt = question;
  } else {
    prompt = `You are a helpful assistant that provides comprehensive answers using insights from a video knowledge base.

Question: ${question}

Context from Video Database:
${context}

Please provide a comprehensive answer that:
1. Directly addresses the question with a clear, concise explanation
2. Integrates specific insights from the video segments when relevant
3. Mentions which concepts or videos the insights come from (with timestamps when helpful)
4. Uses both your general knowledge and the video content to give a complete answer
5. Keeps the tone conversational and helpful
6. If the video content provides unique perspectives or details, highlight those

Format your response naturally, incorporating the video insights smoothly into the explanation rather than listing them separately.`;
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  debugLogger.log("generateAnswerWithContext", "llm_call", {
    requestId,
    promptLength: prompt.length,
    model: modelName,
  });

  const model = googleAI.getGenerativeModel({ model: modelName });

  const startTime = Date.now();
  const result = await model.generateContent(prompt);
  const answer = result.response.text();
  const endTime = Date.now();

  debugLogger.log("generateAnswerWithContext", "complete", {
    requestId,
    answerLength: answer.length,
    durationMs: endTime - startTime,
  });

  return answer;
}

/**
 * Main chat function - answers question using RAG
 */
export async function answerQuestion(question: string): Promise<ChatResponse> {
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  debugLogger.log("answerQuestion", "start", {
    requestId,
    question,
    questionLength: question.length,
    timestamp: new Date().toISOString(),
  });

  try {
    // 1. Get semantic search results
    debugLogger.log("answerQuestion", "semantic_search_start", {
      requestId,
    });

    const searchStartTime = Date.now();
    const graphResults = await semanticSearch(question, requestId);
    const searchDuration = Date.now() - searchStartTime;

    debugLogger.log("answerQuestion", "semantic_search_complete", {
      requestId,
      durationMs: searchDuration,
      conceptsFound: graphResults.concepts.length,
      segmentsFound: graphResults.segments.length,
    });

    console.log(`Found ${graphResults.concepts.length} concepts and ${graphResults.segments.length} segments`);

    // 2. Generate answer with context in one pass
    const answer = await generateAnswerWithContext(
      question,
      graphResults,
      requestId
    );

    debugLogger.log("answerQuestion", "complete", {
      requestId,
      finalAnswerLength: answer.length,
      totalConceptsReturned: graphResults.concepts.length,
      totalSegmentsReturned: graphResults.segments.length,
    });

    return {
      answer,
      sources: graphResults,
    };
  } catch (error) {
    debugLogger.log("answerQuestion", "error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error("Error answering question:", error);
    throw error;
  }
}

/**
 * Get timestamp in seconds for YouTube URL
 */
export function getYouTubeTimestamp(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    // HH:MM:SS
    return (
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
    );
  } else if (parts.length === 2) {
    // MM:SS
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}
