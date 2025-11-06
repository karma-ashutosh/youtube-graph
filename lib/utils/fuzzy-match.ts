import { Concept } from "../types";
import { nameToSlug } from "./parsers";

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1) between two strings
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Find best matching concept using fuzzy string matching
 * Returns match if similarity > threshold
 */
export function findFuzzyMatch(
  rawName: string,
  existingConcepts: Concept[],
  threshold: number = 0.85
): Concept | null {
  const rawLower = rawName.toLowerCase().trim();
  const rawSlug = nameToSlug(rawName);

  let bestMatch: Concept | null = null;
  let bestScore = 0;

  for (const concept of existingConcepts) {
    // Exact match on slug
    if (concept.concept_id === rawSlug) {
      return concept;
    }

    // Exact match on canonical name
    if (concept.canonical_name.toLowerCase() === rawLower) {
      return concept;
    }

    // Exact match on aliases
    for (const alias of concept.aliases) {
      if (alias.toLowerCase() === rawLower) {
        return concept;
      }
    }

    // Fuzzy match on canonical name
    const canonicalScore = similarity(rawLower, concept.canonical_name.toLowerCase());
    if (canonicalScore > bestScore) {
      bestScore = canonicalScore;
      bestMatch = concept;
    }

    // Fuzzy match on aliases
    for (const alias of concept.aliases) {
      const aliasScore = similarity(rawLower, alias.toLowerCase());
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        bestMatch = concept;
      }
    }
  }

  // Return match if above threshold
  return bestScore >= threshold ? bestMatch : null;
}
