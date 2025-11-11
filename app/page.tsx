"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiGet } from "@/lib/api-client";

interface Video {
  video_id: string;
  title: string;
  description?: string;
  published_at?: string;
  duration?: number;
  segment_count?: number;
}

interface Concept {
  concept_id: string;
  canonical_name: string;
  category: string;
  total_mentions: number;
  has_details?: boolean;
  has_primary?: boolean;
}

export default function Home() {
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [topConcepts, setTopConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch recent videos
      const videosData = await apiGet<{ videos: Video[] }>('/api/videos');
      setRecentVideos((videosData.videos || []).slice(0, 3));

      // Fetch top concepts - filter for primary concepts with details
      const conceptsData = await apiGet<{ concepts: Concept[] }>('/api/concepts');
      const filteredConcepts = (conceptsData.concepts || [])
        .filter(concept => concept.has_primary && concept.has_details)
        .slice(0, 6);
      setTopConcepts(filteredConcepts);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light via-accent-cool to-accent-warm">
          Dive Deeper Into Your Favorite Content
        </h1>
        <p className="text-xl text-accent-cool/80 font-medium max-w-3xl mx-auto">
          AI answers your questions. YouTubers explain why it works.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <div className="p-4 border border-accent-cool/30 rounded-lg bg-surface-dark/30">
            <div className="text-3xl mb-3">🎯</div>
            <p className="text-base text-text-light/90">Get  precise answers from knowledge bank of <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold">Your Favorite creators</span> </p>
          </div>
          <div className="p-4 border border-accent-cool/30 rounded-lg bg-surface-dark/30">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-base text-text-light/90">See exact point in video discussing your problem -- <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold">No AI slop</span></p>
          </div>
          <div className="p-4 border border-accent-cool/30 rounded-lg bg-surface-dark/30">
            <div className="text-3xl mb-3">🗺️</div>
            <p className="text-base text-text-light/90"><span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold">Segmented Concepts</span>, for quick check through</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/chat"
            className="px-8 py-4 bg-gradient-to-r from-accent-cool to-accent-warm hover:shadow-glow-cool text-primary-dark font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            💬 Start Exploring
          </Link>
          <Link
            href="/videos"
            className="px-8 py-4 bg-surface-dark border-2 border-accent-cool/50 hover:border-accent-cool text-text-light font-semibold text-lg rounded-xl transition-all duration-300 hover:bg-accent-cool/10"
          >
            📚 Browse Videos
          </Link>
        </div>
      </div>

      {/* Value Propositions */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-light mb-2">
            Why You&apos;ll Love It
          </h2>
          <p className="text-text-light/70">
            The smartest way to interact with video content
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">⏱️</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              Timestamped Answers
            </h3>
            <p className="text-text-light/70">
              Ask any question and get precise answers with exact timestamps. Jump straight to the moments that matter.
            </p>
          </div>
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              Smart Segments
            </h3>
            <p className="text-text-light/70">
              Every video is broken down into digestible segments with detailed summaries, key points, and examples.
            </p>
          </div>
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              Deep Search
            </h3>
            <p className="text-text-light/70">
              Find exactly what you&apos;re looking for across entire video libraries. No more endless scrubbing through timelines.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Videos Section */}
      {!loading && recentVideos.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-text-light mb-2">
              Recent Videos
            </h2>
            <p className="text-text-light/70">
              Start exploring the latest content
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentVideos.map((video) => {
              const thumbnail = `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`;

              return (
                <Link
                  key={video.video_id}
                  href={`/videos/${video.video_id}`}
                  className="block border border-border-subtle rounded-lg overflow-hidden hover:border-accent-cool/50 hover:shadow-glow-cool transition-all duration-300 bg-surface-dark group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-primary-dark">
                    <Image
                      src={thumbnail}
                      alt={video.title || "Video thumbnail"}
                      width={320}
                      height={180}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-text-light group-hover:text-accent-cool transition-colors mb-3 line-clamp-2">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-text-light/60 mb-3 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-text-light/70">
                      {video.duration && (
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDuration(video.duration)}</span>
                        </div>
                      )}
                      {video.segment_count && (
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{video.segment_count} segments</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center">
            <Link
              href="/videos"
              className="inline-flex items-center gap-2 px-6 py-3 bg-surface-dark border border-accent-cool/50 hover:border-accent-cool text-accent-cool font-semibold rounded-lg transition-all duration-300 hover:bg-accent-cool/10"
            >
              View All Videos
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Top Concepts Section */}
      {!loading && topConcepts.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-text-light mb-2">
              Popular Topics
            </h2>
            <p className="text-text-light/70">
              Explore the most discussed concepts across all videos
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {topConcepts.map((concept) => (
              <Link
                key={concept.concept_id}
                href={`/concepts/${concept.concept_id}`}
                className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group text-center"
              >
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-text-light group-hover:text-accent-cool transition-colors">
                    {concept.canonical_name}
                  </h3>
                  <span className="text-xs px-2 py-1 bg-accent-cool/20 text-accent-cool rounded-full font-medium inline-block">
                    {concept.category}
                  </span>
                  <p className="text-xs text-text-light/60">
                    {concept.total_mentions} mentions
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/concepts"
              className="relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-cool to-accent-warm text-primary-dark font-bold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-glow-cool overflow-hidden group"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></span>
              <span className="relative">Explore All Topics</span>
              <svg className="relative w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-light mb-2">
            How It Works
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-cool to-accent-warm rounded-full flex items-center justify-center mx-auto text-3xl font-bold text-primary-dark">
              1
            </div>
            <h3 className="text-xl font-semibold text-text-light">
              Choose Your Content
            </h3>
            <p className="text-text-light/70">
              Browse videos from your favorite creators or search for specific topics.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-cool to-accent-warm rounded-full flex items-center justify-center mx-auto text-3xl font-bold text-primary-dark">
              2
            </div>
            <h3 className="text-xl font-semibold text-text-light">
              Ask Questions
            </h3>
            <p className="text-text-light/70">
              Chat with the AI to find exactly what you&apos;re looking for with precise timestamps.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-cool to-accent-warm rounded-full flex items-center justify-center mx-auto text-3xl font-bold text-primary-dark">
              3
            </div>
            <h3 className="text-xl font-semibold text-text-light">
              Dive Deep
            </h3>
            <p className="text-text-light/70">
              Explore segments, concepts, and connections to get the most out of every video.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="card border-accent-cool/50 bg-gradient-to-br from-surface-dark to-primary-dark text-center space-y-4 py-12">
        <h2 className="text-4xl font-bold text-text-light">
          Ready to Start Exploring?
        </h2>
        <p className="text-lg text-text-light/80 max-w-2xl mx-auto">
          Unlock a whole new way to experience video content. Get instant answers, discover hidden insights, and never miss important moments.
        </p>
        <div className="pt-4">
          <Link
            href="/chat"
            className="inline-flex px-10 py-5 bg-gradient-to-r from-accent-cool to-accent-warm hover:shadow-glow-cool text-primary-dark font-bold text-xl rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            Get Started Now
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-accent-cool border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-text-light/70">Loading content...</p>
          </div>
        </div>
      )}
    </div>
  );
}
