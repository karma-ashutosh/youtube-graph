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
 * Generate a general answer using Gemini
 */
async function generateGeneralAnswer(question: string, requestId: string): Promise<string> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  debugLogger.log("generateGeneralAnswer", "start", {
    requestId,
    question,
    questionLength: question.length,
    model: modelName,
  });

  const model = googleAI.getGenerativeModel({ model: modelName });

  const startTime = Date.now();
  const result = await model.generateContent(question);
  const answer = result.response.text();
  const endTime = Date.now();

  debugLogger.log("generateGeneralAnswer", "complete", {
    requestId,
    answerLength: answer.length,
    durationMs: endTime - startTime,
    model: modelName,
  });

  return answer;
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
 * Enhance general answer with knowledge graph context
 */
async function enhanceWithContext(
  question: string,
  generalAnswer: string,
  graphResults: { concepts: SimilarConcept[]; segments: SimilarSegment[] },
  requestId: string
): Promise<string> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  debugLogger.log("enhanceWithContext", "start", {
    requestId,
    questionLength: question.length,
    generalAnswerLength: generalAnswer.length,
    conceptCount: graphResults.concepts.length,
    segmentCount: graphResults.segments.length,
  });

  const context = buildContextFromGraph(graphResults, requestId);

  if (!context) {
    debugLogger.log("enhanceWithContext", "no_context", {
      requestId,
      message: "No relevant context found, returning general answer",
    });
    return generalAnswer;
  }

  const prompt = `You are a helpful assistant that provides comprehensive answers by combining general knowledge with specific insights from a video knowledge base.

Question: ${question}

General Answer:
${generalAnswer}

Additional Context from Video Database:
${context}

Please provide an enhanced answer that:
1. Starts with a clear, concise explanation
2. Integrates specific insights from the video segments when relevant
3. Mentions which concepts or videos the insights come from
4. Keeps the tone conversational and helpful
5. If the video content contradicts or adds nuance to the general answer, acknowledge that

Format your response naturally, incorporating the video insights smoothly into the explanation rather than listing them separately.`;

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  debugLogger.log("enhanceWithContext", "llm_call", {
    requestId,
    promptLength: prompt.length,
    model: modelName,
  });

  const model = googleAI.getGenerativeModel({ model: modelName });

  const startTime = Date.now();
  const result = await model.generateContent(prompt);
  const enhancedAnswer = result.response.text();
  const endTime = Date.now();

  debugLogger.log("enhanceWithContext", "complete", {
    requestId,
    enhancedAnswerLength: enhancedAnswer.length,
    durationMs: endTime - startTime,
  });

  return enhancedAnswer;
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
    // 1. Get general answer and semantic search in parallel
    debugLogger.log("answerQuestion", "parallel_operations_start", {
      requestId,
      operations: ["generateGeneralAnswer", "semanticSearch"],
    });

    const startTime = Date.now();
    const [generalAnswer, graphResults] = await Promise.all([
      generateGeneralAnswer(question, requestId),
      semanticSearch(question, requestId),
    ]);
    const parallelDuration = Date.now() - startTime;

    debugLogger.log("answerQuestion", "parallel_operations_complete", {
      requestId,
      durationMs: parallelDuration,
      conceptsFound: graphResults.concepts.length,
      segmentsFound: graphResults.segments.length,
      generalAnswerLength: generalAnswer.length,
    });

    console.log(`Found ${graphResults.concepts.length} concepts and ${graphResults.segments.length} segments`);

    // 2. Enhance answer with graph context
    const enhancedAnswer = await enhanceWithContext(
      question,
      generalAnswer,
      graphResults,
      requestId
    );

    debugLogger.log("answerQuestion", "complete", {
      requestId,
      finalAnswerLength: enhancedAnswer.length,
      totalConceptsReturned: graphResults.concepts.length,
      totalSegmentsReturned: graphResults.segments.length,
    });

    return {
      answer: enhancedAnswer,
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
