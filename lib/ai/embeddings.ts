import { GoogleGenerativeAI } from "@google/generative-ai";
import { debugLogger } from "../debug-logger";

const googleAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

// In-memory cache to avoid redundant API calls
const embeddingCache = new Map<string, number[]>();

/**
 * Generate embedding vector for text using Gemini's embedding model
 * @param text - Text to embed
 * @returns 768-dimensional embedding vector
 */
export async function generateEmbedding(text: string, requestId?: string): Promise<number[]> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  // Normalize and cache key
  const cacheKey = text.toLowerCase().trim();

  debugLogger.log("generateEmbedding", "start", {
    requestId,
    textLength: text.length,
    cacheKey: cacheKey.slice(0, 50), // First 50 chars
    cacheSize: embeddingCache.size,
  });

  if (embeddingCache.has(cacheKey)) {
    debugLogger.log("generateEmbedding", "cache_hit", {
      requestId,
      cacheKey: cacheKey.slice(0, 50),
      embeddingDimensions: embeddingCache.get(cacheKey)!.length,
    });
    return embeddingCache.get(cacheKey)!;
  }

  debugLogger.log("generateEmbedding", "cache_miss", {
    requestId,
    cacheKey: cacheKey.slice(0, 50),
    willCallAPI: true,
  });

  try {
    const model = googleAI.getGenerativeModel({
      model: "text-embedding-004",
    });

    const startTime = Date.now();
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    const duration = Date.now() - startTime;

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    debugLogger.log("generateEmbedding", "complete", {
      requestId,
      embeddingDimensions: embedding.length,
      durationMs: duration,
      newCacheSize: embeddingCache.size,
    });

    return embedding;
  } catch (error) {
    debugLogger.log("generateEmbedding", "error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(
  texts: string[],
  requestId?: string
): Promise<number[][]> {
  debugLogger.log("generateEmbeddings", "start", {
    requestId,
    textCount: texts.length,
  });

  const embeddings: number[][] = [];
  const startTime = Date.now();

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    try {
      const embedding = await generateEmbedding(text, requestId);
      embeddings.push(embedding);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to generate embedding for: ${text.slice(0, 50)}...`);
      // Push zero vector as fallback
      embeddings.push(new Array(768).fill(0));

      debugLogger.log("generateEmbeddings", "item_error", {
        requestId,
        index: i,
        textPreview: text.slice(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const duration = Date.now() - startTime;

  debugLogger.log("generateEmbeddings", "complete", {
    requestId,
    textCount: texts.length,
    embeddingsGenerated: embeddings.length,
    durationMs: duration,
    averageDurationPerItem: duration / texts.length,
  });

  return embeddings;
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats() {
  return {
    size: embeddingCache.size,
    keys: Array.from(embeddingCache.keys()).slice(0, 10), // First 10 keys
  };
}
