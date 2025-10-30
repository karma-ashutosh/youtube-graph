"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function SegmentDetailPage() {
  const params = useParams();
  const segmentId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (segmentId) {
      fetchSegmentDetail();
    }
  }, [segmentId]);

  const fetchSegmentDetail = async () => {
    try {
      const response = await fetch(`/api/segments/${segmentId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch segment");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getYouTubeTimestamp = (timeStr: string) => {
    const parts = timeStr.split(":");
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading segment...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-red-700 dark:text-red-400">Error</h3>
        <p className="text-sm text-red-600 dark:text-red-300">
          {error || "Segment not found"}
        </p>
        <Link href="/segments" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to segments
        </Link>
      </div>
    );
  }

  const { segment, video, concepts, examples, keyIdeas } = data;

  // Separate concepts by role
  const primaryConcepts = concepts.filter((c: any) => c.discusses?.properties?.role === "primary");
  const supportingConcepts = concepts.filter((c: any) => c.discusses?.properties?.role === "supporting");
  const mentionedConcepts = concepts.filter((c: any) => c.discusses?.properties?.role === "mentioned");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/segments"
          className="text-blue-600 hover:underline text-sm mb-2 inline-block"
        >
          ← Back to segments
        </Link>
        <h1 className="text-3xl font-bold">{segment.topic_hint}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {segment.start_time} - {segment.end_time} ({segment.duration_seconds}s)
        </p>
      </div>

      {/* Video Info */}
      <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3">Video</h2>
        <a
          href={`${video.url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          Watch on YouTube
        </a>
      </div>

      {/* Primary Concepts */}
      {primaryConcepts.length > 0 && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Primary Concepts</h2>
          <div className="space-y-3">
            {primaryConcepts.map((item: any, i: number) => {
              const concept = item.concept?.properties;
              const discusses = item.discusses?.properties;
              if (!concept) return null;

              return (
                <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                  <Link
                    href={`/concepts/${concept.concept_id}`}
                    className="text-lg font-medium hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {concept.canonical_name}
                  </Link>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Coverage: {discusses?.coverage_depth} | Type: {discusses?.explanation_type}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Supporting Concepts */}
      {supportingConcepts.length > 0 && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Supporting Concepts</h2>
          <div className="flex flex-wrap gap-2">
            {supportingConcepts.map((item: any, i: number) => {
              const concept = item.concept?.properties;
              if (!concept) return null;

              return (
                <Link
                  key={i}
                  href={`/concepts/${concept.concept_id}`}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                >
                  {concept.canonical_name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mentioned Concepts */}
      {mentionedConcepts.length > 0 && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Mentioned Concepts</h2>
          <div className="flex flex-wrap gap-2">
            {mentionedConcepts.map((item: any, i: number) => {
              const concept = item.concept?.properties;
              if (!concept) return null;

              return (
                <Link
                  key={i}
                  href={`/concepts/${concept.concept_id}`}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {concept.canonical_name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Examples</h2>
          <div className="space-y-3">
            {examples.map((example: any, i: number) => (
              <div
                key={i}
                className="border-l-4 border-purple-500 pl-4 py-2 bg-gray-50 dark:bg-gray-900 rounded"
              >
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {example.example_type}
                  {example.company_name && ` - ${example.company_name}`}
                </div>
                <div className="text-sm">{example.example_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Ideas */}
      {keyIdeas.length > 0 && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Key Ideas</h2>
          <div className="space-y-2">
            {keyIdeas.map((idea: any, i: number) => (
              <div key={i} className="border rounded p-3 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                    {idea.idea_type}
                  </span>
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        idea.is_novel
                          ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      {idea.is_novel ? "Novel" : "Known"}
                    </span>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {idea.confidence} confidence
                    </span>
                  </div>
                </div>
                <div className="text-sm mt-2">{idea.idea_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
