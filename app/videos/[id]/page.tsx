"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function VideoDetailPage() {
  const params = useParams();
  const videoId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoId) {
      fetchVideoDetail();
    }
  }, [videoId]);

  const fetchVideoDetail = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch video");
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
        <div className="text-lg text-text-light">Loading video...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card border-accent-hot bg-accent-hot/10">
        <h3 className="font-semibold text-accent-hot glow-text-hot">Error</h3>
        <p className="text-sm text-text-light/80">
          {error || "Video not found"}
        </p>
      </div>
    );
  }

  const { video, segments } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
          Video Details
        </h1>
        <p className="text-text-light/70 mt-2">
          Video ID: {video.video_id}
        </p>
      </div>

      {/* Video Info */}
      <div className="card border-accent-cool/50">
        <h2 className="text-xl font-semibold mb-3 text-text-light">Video</h2>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          Watch on YouTube
        </a>
      </div>

      {/* Segments */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4 text-text-light">
          Segments ({segments.length})
        </h2>
        <div className="space-y-6">
          {segments.map((segment: any, i: number) => (
            <div
              key={segment.segment_id}
              className="border border-border-subtle rounded-lg p-4 bg-surface-dark hover:border-accent-cool/50 transition-all duration-300"
            >
              {/* Segment Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <Link
                    href={`/segments/${segment.segment_id}`}
                    className="text-lg font-semibold text-accent-cool hover:glow-text-cool"
                  >
                    Segment {i + 1}: {segment.topic_hint}
                  </Link>
                  <p className="text-sm text-text-light/60 mt-1">
                    {segment.start_time} - {segment.end_time} ({segment.duration_seconds}s)
                  </p>
                </div>
                <a
                  href={`${video.url}&t=${getYouTubeTimestamp(segment.start_time)}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm ml-4"
                >
                  Play
                </a>
              </div>

              {/* Transcript */}
              {segment.transcript && (
                <div className="mt-3 p-3 bg-primary-dark rounded border border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-light/70 mb-2">
                    Transcript
                  </h3>
                  <div className="text-sm text-text-light/80 leading-relaxed line-clamp-4">
                    {segment.transcript}
                  </div>
                  <Link
                    href={`/segments/${segment.segment_id}`}
                    className="text-xs text-accent-cool hover:glow-text-cool mt-2 inline-block"
                  >
                    View full details →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
