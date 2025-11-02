import { GoogleGenerativeAI } from "@google/generative-ai";

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
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!googleAI) {
    throw new Error("Google API key not configured");
  }

  // Normalize and cache key
  const cacheKey = text.toLowerCase().trim();

  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  try {
    const model = googleAI.getGenerativeModel({
      model: "text-embedding-004",
    });

    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (error) {
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
  texts: string[]
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to generate embedding for: ${text.slice(0, 50)}...`);
      // Push zero vector as fallback
      embeddings.push(new Array(768).fill(0));
    }
  }

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
