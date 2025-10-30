import { AnalysisData, SegmentData } from "../types";
import { AnalysisDataSchema } from "./validators";

/**
 * Extract YouTube video ID from URL
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
export function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error(`Invalid YouTube URL: ${url}`);
}

/**
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }

  throw new Error(`Invalid time format: ${timeStr}`);
}

/**
 * Calculate duration between start and end times
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  return endSeconds - startSeconds;
}

/**
 * Parse and validate analysis JSON from segment data
 */
export function parseAnalysisJson(jsonString: string): AnalysisData {
  try {
    const parsed = JSON.parse(jsonString);
    return AnalysisDataSchema.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse analysis JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convert concept name to slug (concept_id)
 * Example: "Product-Market Fit" -> "product_market_fit"
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Process a segment data record and extract all necessary information
 */
export function processSegmentData(segment: SegmentData) {
  const videoId = extractVideoId(segment.video_url);
  const analysis = parseAnalysisJson(segment.analysis_json);
  const duration = calculateDuration(segment.start_time, segment.end_time);
  const segmentId = segment.id || generateId();

  return {
    segmentId,
    videoId,
    analysis,
    duration,
    startTime: segment.start_time,
    endTime: segment.end_time,
    topicHint: segment.topic_hint,
    videoUrl: segment.video_url,
  };
}
