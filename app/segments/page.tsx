"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Segment {
  segment: {
    segment_id: string;
    topic_hint: string;
    start_time: string;
    end_time: string;
    duration_seconds: number;
    video_id: string;
    created_at: string;
  };
  video: {
    video_id: string;
    url: string;
    created_at: string;
  };
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const response = await fetch("/api/segments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch segments");
      }

      setSegments(data.segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const filteredSegments = segments.filter((item) =>
    item.segment.topic_hint?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to format time for YouTube URL
  const getYouTubeTimestamp = (timeStr: string) => {
    const parts = timeStr.split(":");
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading segments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-red-700 dark:text-red-400">Error</h3>
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Segments</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse all video segments in the knowledge graph
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search segments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSegments.length} of {segments.length} segments
      </div>

      <div className="space-y-4">
        {filteredSegments.map((item) => (
          <div
            key={item.segment.segment_id}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
          >
            <div className="flex justify-between items-start mb-3">
              <Link
                href={`/segments/${item.segment.segment_id}`}
                className="text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400"
              >
                {item.segment.topic_hint}
              </Link>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                {item.segment.duration_seconds}s
              </span>
            </div>

            <div className="flex gap-4 items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
              <span>
                {item.segment.start_time} - {item.segment.end_time}
              </span>
            </div>

            <div className="flex gap-2">
              <a
                href={`${item.video.url}&t=${getYouTubeTimestamp(item.segment.start_time)}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Watch on YouTube →
              </a>
              <Link
                href={`/segments/${item.segment.segment_id}`}
                className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredSegments.length === 0 && (
        <div className="text-center text-gray-600 dark:text-gray-400 py-12">
          No segments found matching your search.
        </div>
      )}
    </div>
  );
}
