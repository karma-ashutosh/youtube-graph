import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Concept, NormalizedConcept } from "../types";
import { nameToSlug } from "../utils/parsers";
import { NormalizedConceptSchema } from "../utils/validators";

// Determine which AI provider to use from environment
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini"; // "claude" or "gemini"

// Initialize clients
const anthropic = AI_PROVIDER === "claude" && process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const googleAI = AI_PROVIDER === "gemini" && process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

/**
 * Build the prompt for concept normalization
 */
function buildNormalizationPrompt(
  rawName: string,
  existingConcepts: Concept[]
): string {
  // Take top 50 most mentioned concepts for context
  const topConcepts = existingConcepts
    .slice(0, 50)
    .map(
      (c) =>
        `- ${c.canonical_name} (aliases: ${c.aliases.join(", ") || "none"})`
    )
    .join("\n");

  return `You are normalizing concept names for a knowledge graph.

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
If matching existing concept:
{
  "canonical_name": "Product-Market Fit",
  "concept_id": "product_market_fit",
  "is_new": false,
  "matched_existing_id": "product_market_fit",
  "confidence": "high"
}

If creating new concept:
{
  "canonical_name": "New Concept Name",
  "concept_id": "new_concept_name",
  "is_new": true,
  "matched_existing_id": null,
  "confidence": "medium"
}`;
}

/**
 * Parse JSON response with error handling
 */
function parseJsonResponse(text: string): any {
  // Try to extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const cleanText = jsonMatch ? jsonMatch[1] : text;

  return JSON.parse(cleanText.trim());
}

/**
 * Use Claude to normalize a concept
 */
async function normalizeWithClaude(
  rawName: string,
  existingConcepts: Concept[]
): Promise<NormalizedConcept> {
  if (!anthropic) {
    throw new Error("Claude API key not configured. Set ANTHROPIC_API_KEY in .env");
  }

  const prompt = buildNormalizationPrompt(rawName, existingConcepts);

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const parsed = parseJsonResponse(content.text);
    return NormalizedConceptSchema.parse(parsed);
  } catch (error) {
    console.error("Error normalizing concept with Claude:", error);
    throw error;
  }
}

/**
 * Use Gemini to normalize a concept
 */
async function normalizeWithGemini(
  rawName: string,
  existingConcepts: Concept[]
): Promise<NormalizedConcept> {
  if (!googleAI) {
    throw new Error("Gemini API key not configured. Set GOOGLE_API_KEY in .env");
  }

  const prompt = buildNormalizationPrompt(rawName, existingConcepts);

  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const model = googleAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const parsed = parseJsonResponse(text);
    return NormalizedConceptSchema.parse(parsed);
  } catch (error) {
    console.error("Error normalizing concept with Gemini:", error);
    throw error;
  }
}

/**
 * Use LLM to normalize a concept name against existing concepts
 * This helps avoid duplicates by matching similar concepts
 */
export async function normalizeConcept(
  rawName: string,
  existingConcepts: Concept[]
): Promise<NormalizedConcept> {
  try {
    if (AI_PROVIDER === "claude") {
      return await normalizeWithClaude(rawName, existingConcepts);
    } else if (AI_PROVIDER === "gemini") {
      return await normalizeWithGemini(rawName, existingConcepts);
    } else {
      throw new Error(
        `Unknown AI provider: ${AI_PROVIDER}. Use "claude" or "gemini"`
      );
    }
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
