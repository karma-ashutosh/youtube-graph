import { z } from "zod";

// Input data schemas
export const AnalysisDataSchema = z.object({
  primary_concept: z.object({
    name: z.string(),
    coverage_depth: z.enum(["comprehensive", "partial", "reference_only", "surface"]),
    explanation_type: z.enum([
      "definition",
      "case_study",
      "how_to",
      "comparison",
      "metaphor",
      "story",
    ]),
  }),
  supporting_concepts: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      coverage_depth: z.enum(["comprehensive", "partial", "reference_only", "surface"]),
    })
  ),
  mentioned_concepts: z.array(
    z.object({
      name: z.string(),
      context: z.string(),
      coverage_depth: z.enum(["comprehensive", "partial", "reference_only", "surface"]),
    })
  ).optional(),
  key_ideas: z.array(
    z.object({
      idea: z.string(),
      type: z.enum(["fact", "advice", "insight", "metric", "opinion", "definition", "observation"]),
      is_novel: z.boolean(),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  examples: z.array(
    z.object({
      example_text: z.string(),
      type: z.enum([
        "real_company",
        "personal_story",
        "metaphor",
        "hypothetical",
        "data_point",
      ]),
      concept_illustrated: z.string(),
    })
  ),
});

export const SegmentDataSchema = z.object({
  id: z.union([z.string(), z.number(), z.null()]).transform((val) =>
    val === null ? null : String(val)
  ),
  video_url: z.string().url(),
  start_time: z.string(), // "00:03:54"
  end_time: z.string(), // "00:04:42"
  topic_hint: z.string(),
  analysis_json: z.union([z.string(), z.object({}).passthrough()]).transform((val) =>
    typeof val === 'string' ? val : JSON.stringify(val)
  ),
  created_at: z.union([z.string(), z.null()]).optional(),
  updated_at: z.union([z.string(), z.null()]).optional(),
});

// Array of segments for batch upload
export const SegmentBatchSchema = z.array(SegmentDataSchema);

// Normalized concept response schema
export const NormalizedConceptSchema = z.object({
  canonical_name: z.string(),
  concept_id: z.string(),
  is_new: z.boolean(),
  matched_existing_id: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});
