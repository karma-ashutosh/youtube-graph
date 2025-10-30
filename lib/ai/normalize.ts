import OpenAI from "openai";
import { Concept, NormalizedConcept } from "../types";
import { nameToSlug } from "../utils/parsers";
import { NormalizedConceptSchema } from "../utils/validators";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Use LLM to normalize a concept name against existing concepts
 * This helps avoid duplicates by matching similar concepts
 */
export async function normalizeConcept(
  rawName: string,
  existingConcepts: Concept[]
): Promise<NormalizedConcept> {
  // Take top 50 most mentioned concepts for context
  const topConcepts = existingConcepts
    .slice(0, 50)
    .map(
      (c) =>
        `- ${c.canonical_name} (aliases: ${c.aliases.join(", ") || "none"})`
    )
    .join("\n");

  const prompt = `You are normalizing concept names for a knowledge graph.

EXISTING CONCEPTS (top 50 for context):
${topConcepts || "No existing concepts yet."}

NEW CONCEPT TO NORMALIZE:
"${rawName}"

TASK:
1. Check if this matches any existing concept (including aliases)
2. If YES: Return the existing canonical_name and concept_id
3. If NO: Create a new canonical_name (2-4 words, clear, concise)

RULES:
- Be conservative: prefer matching to existing over creating new
- "PMF" = "Product-Market Fit" (match variations)
- "Marketing Tactic Selection" = "Marketing Tactics" (match similar phrasing)
- Ignore case and minor punctuation differences
- Focus on semantic meaning

OUTPUT (JSON only, no explanation):
{
  "canonical_name": "Product-Market Fit",
  "concept_id": "product_market_fit",
  "is_new": false,
  "matched_existing_id": "product_market_fit",
  "confidence": "high"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a concept normalization expert. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const validated = NormalizedConceptSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error("Error normalizing concept with LLM:", error);

    // Fallback: Create new concept if LLM fails
    return {
      canonical_name: rawName,
      concept_id: nameToSlug(rawName),
      is_new: true,
      confidence: "low",
    };
  }
}

/**
 * Batch normalize multiple concepts
 * More efficient than calling normalizeConcept repeatedly
 */
export async function normalizeConceptsBatch(
  rawNames: string[],
  existingConcepts: Concept[]
): Promise<Map<string, NormalizedConcept>> {
  const results = new Map<string, NormalizedConcept>();

  // Process in parallel with a limit to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < rawNames.length; i += batchSize) {
    const batch = rawNames.slice(i, i + batchSize);
    const promises = batch.map((name) =>
      normalizeConcept(name, existingConcepts)
    );
    const batchResults = await Promise.all(promises);

    batch.forEach((name, index) => {
      results.set(name, batchResults[index]);
    });
  }

  return results;
}

/**
 * Simple in-memory cache for concept normalization
 * Refreshes when the cache gets too old or too large
 */
class ConceptCache {
  private cache: Map<string, NormalizedConcept> = new Map();
  private lastRefresh: number = 0;
  private readonly MAX_AGE = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_SIZE = 1000;

  set(key: string, value: NormalizedConcept): void {
    if (this.cache.size >= this.MAX_SIZE) {
      // Clear oldest entries
      const entries = Array.from(this.cache.entries());
      entries.slice(0, this.MAX_SIZE / 2).forEach(([k]) => this.cache.delete(k));
    }
    this.cache.set(key, value);
  }

  get(key: string): NormalizedConcept | undefined {
    if (Date.now() - this.lastRefresh > this.MAX_AGE) {
      this.clear();
      return undefined;
    }
    return this.cache.get(key);
  }

  clear(): void {
    this.cache.clear();
    this.lastRefresh = Date.now();
  }

  needsRefresh(): boolean {
    return Date.now() - this.lastRefresh > this.MAX_AGE;
  }
}

export const conceptCache = new ConceptCache();
