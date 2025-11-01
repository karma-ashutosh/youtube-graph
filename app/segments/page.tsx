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
        <div className="text-lg text-text-light">Loading segments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-accent-hot bg-accent-hot/10">
        <h3 className="font-semibold text-accent-hot glow-text-hot">Error</h3>
        <p className="text-sm text-text-light/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">Segments</h1>
        <p className="text-text-light/80 mt-2">
          Browse all video segments in the knowledge graph
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search segments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
        />
      </div>

      <div className="text-sm text-text-light/60">
        Showing {filteredSegments.length} of {segments.length} segments
      </div>

      <div className="space-y-4">
        {filteredSegments.map((item) => (
          <div
            key={item.segment.segment_id}
            className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-3">
              <Link
                href={`/segments/${item.segment.segment_id}`}
                className="text-lg font-semibold text-text-light hover:text-accent-cool transition-colors"
              >
                {item.segment.topic_hint}
              </Link>
              <span className="text-xs px-2 py-1 bg-accent-cool/20 text-accent-cool rounded">
                {item.segment.duration_seconds}s
              </span>
            </div>

            <div className="flex gap-4 items-center text-sm text-text-light/60 mb-3">
              <span>
                {item.segment.start_time} - {item.segment.end_time}
              </span>
            </div>

            <div className="flex gap-2">
              <a
                href={`${item.video.url}&t=${getYouTubeTimestamp(item.segment.start_time)}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm"
              >
                Watch on YouTube →
              </a>
              <Link
                href={`/segments/${item.segment.segment_id}`}
                className="btn-secondary text-sm"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredSegments.length === 0 && (
        <div className="text-center text-text-light/60 py-12">
          No segments found matching your search.
        </div>
      )}
    </div>
  );
}
