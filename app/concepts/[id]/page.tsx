"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";

export default function ConceptDetailPage() {
  const params = useParams();
  const conceptId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conceptId) {
      fetchConceptDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const fetchConceptDetail = async () => {
    try {
      const result = await apiGet<any>(`/api/concepts/${conceptId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-text-light">Loading concept...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card border-accent-hot bg-accent-hot/10">
        <h3 className="font-semibold text-accent-hot glow-text-hot">Error</h3>
        <p className="text-sm text-text-light/80">
          {error || "Concept not found"}
        </p>
        <Link href="/concepts" className="text-accent-cool hover:text-accent-cool/80 hover:glow-text-cool mt-2 inline-block">
          Back to concepts
        </Link>
      </div>
    );
  }

  const { concept, segments, examples, keyIdeas, relatedConcepts } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/concepts"
          className="text-accent-cool hover:glow-text-cool text-sm mb-2 inline-block"
        >
          ← Back to concepts
        </Link>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">{concept.canonical_name}</h1>

        {concept.aliases && concept.aliases.length > 0 && (
          <p className="text-text-light/70 mt-2">
            Also known as: {concept.aliases.join(", ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-text-light/60">
            Category
          </div>
          <div className="text-lg font-semibold text-text-light">{concept.category}</div>
        </div>

        <div className="card">
          <div className="text-sm text-text-light/60">
            Total Mentions
          </div>
          <div className="text-lg font-semibold text-text-light">{concept.total_mentions}</div>
        </div>

        <div className="card">
          <div className="text-sm text-text-light/60">
            Importance
          </div>
          <div className="text-lg font-semibold text-accent-cool">
            {(concept.importance_score * 100).toFixed(0)}%
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-text-light/60">
            Segments
          </div>
          <div className="text-lg font-semibold text-text-light">{segments.length}</div>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4 text-text-light">Video Segments</h2>
          <div className="space-y-3">
            {segments.map((item: any, i: number) => {
              const seg = item.segment?.properties;
              const vid = item.video?.properties;
              const discusses = item.discusses?.properties;

              if (!seg) return null;

              return (
                <div
                  key={i}
                  className="border rounded p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">{seg.topic_hint}</div>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {discusses?.role || "mentioned"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Time: {seg.start_time} - {seg.end_time} (
                    {seg.duration_seconds}s)
                  </div>
                  <div className="flex gap-3 mt-2">
                    <Link
                      href={`/segments/${seg.segment_id}`}
                      className="text-accent-cool hover:glow-text-cool text-sm"
                    >
                      View segment →
                    </Link>
                    {vid && (
                      <a
                        href={`${vid.url}&t=${seg.start_time
                          .split(":")
                          .reduce(
                            (acc: number, val: string, i: number) =>
                              acc + parseInt(val) * Math.pow(60, 2 - i),
                            0
                          )}s`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Watch segment →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {examples.length > 0 && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4 text-text-light">Examples</h2>
          <div className="space-y-3">
            {examples.map((example: any, i: number) => (
              <div
                key={i}
                className="border-l-4 border-blue-500 pl-4 py-2"
              >
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {example.example_type}
                  {example.company_name && ` - ${example.company_name}`}
                </div>
                <div>{example.example_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {keyIdeas.length > 0 && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4 text-text-light">Key Ideas</h2>
          <div className="space-y-2">
            {keyIdeas.map((idea: any, i: number) => (
              <div key={i} className="border rounded p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                    {idea.idea_type}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      idea.is_novel
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {idea.is_novel ? "Novel" : "Known"}
                  </span>
                </div>
                <div className="text-sm">{idea.idea_text}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Confidence: {idea.confidence}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedConcepts.length > 0 && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-4 text-text-light">Related Concepts</h2>
          <div className="flex flex-wrap gap-2">
            {relatedConcepts.map((item: any, i: number) => {
              const related = item.concept?.properties;
              if (!related) return null;

              return (
                <Link
                  key={i}
                  href={`/concepts/${related.concept_id}`}
                  className="px-3 py-1 border rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  {related.canonical_name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
