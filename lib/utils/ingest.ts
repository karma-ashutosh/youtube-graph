import { SegmentData, NormalizedConcept } from "../types";
import { processSegmentData, generateId, nameToSlug } from "./parsers";
import {
  getAllConcepts,
  createOrGetVideo,
  createSegment,
  createConcept,
  updateConcept,
  linkSegmentToConcept,
  createExample,
  createKeyIdea,
} from "../neo4j/queries";
import { normalizeConcept } from "../ai/normalize";

/**
 * Process a single segment and add it to the knowledge graph
 */
export async function ingestSegment(segment: SegmentData): Promise<{
  success: boolean;
  segmentId: string;
  conceptsProcessed: number;
  error?: string;
}> {
  try {
    // Parse and extract segment data
    const {
      segmentId,
      videoId,
      analysis,
      duration,
      startTime,
      endTime,
      topicHint,
      videoUrl,
    } = processSegmentData(segment);

    // Get existing concepts for normalization
    const existingConcepts = await getAllConcepts();

    // Step 1: Create or get video node
    await createOrGetVideo(videoId, videoUrl);

    // Step 2: Create segment node
    await createSegment({
      segmentId,
      videoId,
      startTime,
      endTime,
      durationSeconds: duration,
      topicHint,
    });

    let conceptsProcessed = 0;

    // Step 3: Process primary concept
    const primaryConcept = await normalizeConcept(
      analysis.primary_concept.name,
      existingConcepts
    );

    await processConceptNode(primaryConcept, analysis.primary_concept.name);

    await linkSegmentToConcept({
      segmentId,
      conceptId: primaryConcept.concept_id,
      role: "primary",
      coverageDepth: analysis.primary_concept.coverage_depth,
      explanationType: analysis.primary_concept.explanation_type,
    });

    conceptsProcessed++;

    // Step 4: Process supporting concepts
    for (const supportingConcept of analysis.supporting_concepts) {
      const normalized = await normalizeConcept(
        supportingConcept.name,
        existingConcepts
      );

      await processConceptNode(normalized, supportingConcept.name);

      await linkSegmentToConcept({
        segmentId,
        conceptId: normalized.concept_id,
        role: "supporting",
        coverageDepth: supportingConcept.coverage_depth,
      });

      conceptsProcessed++;
    }

    // Step 5: Process mentioned concepts
    for (const mentionedConcept of analysis.mentioned_concepts) {
      const normalized = await normalizeConcept(
        mentionedConcept.name,
        existingConcepts
      );

      await processConceptNode(normalized, mentionedConcept.name);

      await linkSegmentToConcept({
        segmentId,
        conceptId: normalized.concept_id,
        role: "mentioned",
        coverageDepth: mentionedConcept.coverage_depth,
      });

      conceptsProcessed++;
    }

    // Step 6: Create examples
    for (const example of analysis.examples) {
      // Find the concept this example illustrates
      const illustratedConcept = await normalizeConcept(
        example.concept_illustrated,
        existingConcepts
      );

      await createExample({
        exampleId: generateId(),
        exampleText: example.example_text,
        exampleType: example.type,
        conceptId: illustratedConcept.concept_id,
        segmentId,
        companyName:
          example.type === "real_company"
            ? extractCompanyName(example.example_text)
            : undefined,
      });
    }

    // Step 7: Create key ideas
    for (const keyIdea of analysis.key_ideas) {
      // Link to primary concept by default
      await createKeyIdea({
        ideaId: generateId(),
        ideaText: keyIdea.idea,
        ideaType: keyIdea.type,
        isNovel: keyIdea.is_novel,
        confidence: keyIdea.confidence,
        conceptId: primaryConcept.concept_id,
        segmentId,
      });
    }

    return {
      success: true,
      segmentId,
      conceptsProcessed,
    };
  } catch (error) {
    console.error("Error ingesting segment:", error);
    return {
      success: false,
      segmentId: segment.id || "unknown",
      conceptsProcessed: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Helper function to create or update a concept node
 */
async function processConceptNode(
  normalized: NormalizedConcept,
  originalName: string
): Promise<void> {
  if (normalized.is_new) {
    // Create new concept
    await createConcept({
      conceptId: normalized.concept_id,
      canonicalName: normalized.canonical_name,
      aliases: originalName !== normalized.canonical_name ? [originalName] : [],
    });
  } else {
    // Update existing concept
    const newAlias =
      originalName !== normalized.canonical_name ? originalName : undefined;
    await updateConcept({
      conceptId: normalized.concept_id,
      newAlias,
    });
  }
}

/**
 * Extract company name from example text (simple heuristic)
 */
function extractCompanyName(text: string): string | undefined {
  // Look for patterns like "Company like X" or "X did this"
  // This is a simple implementation - could be improved with NER
  const patterns = [
    /(?:company like|companies like)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:did|does|is|was)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Process multiple segments in batch
 */
export async function ingestSegmentsBatch(
  segments: SegmentData[]
): Promise<{
  totalSegments: number;
  successfulSegments: number;
  failedSegments: number;
  totalConceptsProcessed: number;
  errors: Array<{ segmentId: string; error: string }>;
}> {
  const results = {
    totalSegments: segments.length,
    successfulSegments: 0,
    failedSegments: 0,
    totalConceptsProcessed: 0,
    errors: [] as Array<{ segmentId: string; error: string }>,
  };

  for (const segment of segments) {
    const result = await ingestSegment(segment);

    if (result.success) {
      results.successfulSegments++;
      results.totalConceptsProcessed += result.conceptsProcessed;
    } else {
      results.failedSegments++;
      results.errors.push({
        segmentId: result.segmentId,
        error: result.error || "Unknown error",
      });
    }
  }

  return results;
}
