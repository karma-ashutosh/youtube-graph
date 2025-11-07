"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiGet } from "@/lib/api-client";

interface Video {
  video_id: string;
  url: string;
  title?: string;
  created_at: string;
  segment_count: number;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const result = await apiGet<{ videos: Video[] }>("/api/videos");
      setVideos(result.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (videoIdMatch) {
      return `https://img.youtube.com/vi/${videoIdMatch[1]}/mqdefault.jpg`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-text-light">Loading videos...</div>
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
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
          Videos
        </h1>
        <p className="text-text-light/70 mt-2">
          Browse all videos in the knowledge graph
        </p>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-light">
            All Videos ({videos.length})
          </h2>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-text-light/60">
            <p>No videos found in the database.</p>
            <Link
              href="/upload"
              className="text-accent-cool hover:glow-text-cool mt-2 inline-block"
            >
              Upload your first video →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => {
              const thumbnail = getYouTubeThumbnail(video.url);

              return (
                <Link
                  key={video.video_id}
                  href={`/videos/${video.video_id}`}
                  className="block border border-border-subtle rounded-lg overflow-hidden hover:border-accent-cool/50 transition-all duration-300 bg-surface-dark group"
                >
                  {/* Thumbnail */}
                  {thumbnail && (
                    <div className="relative aspect-video bg-primary-dark">
                      <Image
                        src={thumbnail}
                        alt="Video thumbnail"
                        width={320}
                        height={180}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-text-light group-hover:text-accent-cool transition-colors line-clamp-2">
                        {video.title || `Video ${video.video_id}`}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between text-sm text-text-light/60 mt-3">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                          />
                        </svg>
                        <span>{video.segment_count} segments</span>
                      </div>
                      <span>{formatDate(video.created_at)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
