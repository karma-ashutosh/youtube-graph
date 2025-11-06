import { GoogleGenerativeAI } from "@google/generative-ai";
import { semanticSearch, SimilarConcept, SimilarSegment } from "../neo4j/vector";

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
async function generateGeneralAnswer(question: string): Promise<string> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  const model = googleAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash"
  });

  const result = await model.generateContent(question);
  return result.response.text();
}

/**
 * Build context string from knowledge graph results
 */
function buildContextFromGraph(results: {
  concepts: SimilarConcept[];
  segments: SimilarSegment[];
}): string {
  const { concepts, segments } = results;

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

  return context;
}

/**
 * Enhance general answer with knowledge graph context
 */
async function enhanceWithContext(
  question: string,
  generalAnswer: string,
  graphResults: { concepts: SimilarConcept[]; segments: SimilarSegment[] }
): Promise<string> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  const context = buildContextFromGraph(graphResults);

  if (!context) {
    // No relevant context found, return general answer
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

  const model = googleAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash"
  });
  const result = await model.generateContent(prompt);

  return result.response.text();
}

/**
 * Main chat function - answers question using RAG
 */
export async function answerQuestion(question: string): Promise<ChatResponse> {
  try {
    // 1. Get general answer and semantic search in parallel
    const [generalAnswer, graphResults] = await Promise.all([
      generateGeneralAnswer(question),
      semanticSearch(question),
    ]);

    console.log(`Found ${graphResults.concepts.length} concepts and ${graphResults.segments.length} segments`);

    // 2. Enhance answer with graph context
    const enhancedAnswer = await enhanceWithContext(
      question,
      generalAnswer,
      graphResults
    );

    return {
      answer: enhancedAnswer,
      sources: graphResults,
    };
  } catch (error) {
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
