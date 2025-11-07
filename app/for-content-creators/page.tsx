"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api-client";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface Concept {
  concept_id: string;
  canonical_name: string;
  category: string;
  total_mentions: number;
  aliases?: string[];
  has_details?: boolean;
  has_primary?: boolean;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    mentions?: number;
    importance?: number;
    category?: string;
    roles?: string[];
    has_primary?: boolean;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
    role?: string;
  }>;
}

export default function Home() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef<any>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all concepts
      const conceptsData = await apiGet<{ concepts: Concept[] }>('/api/concepts');

      // Filter for concepts that are primary and have details (examples or key ideas)
      const filteredConcepts = (conceptsData.concepts || [])
        .filter(concept => concept.has_primary && concept.has_details)
        .slice(0, 6);

      setConcepts(filteredConcepts);

      // Fetch graph data
      const params = new URLSearchParams();
      params.append("limit", "30");
      params.append("roleFilter", "primary");
      params.append("includeSegments", "false");
      const graphResponse = await apiGet<GraphData>(`/api/graph?${params}`);
      setGraphData(graphResponse);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light via-accent-cool to-accent-warm">
          Your Content, Reimagined
        </h1>
        <p className="text-2xl text-text-light/90 max-w-4xl mx-auto leading-relaxed">
          Turn your videos into an <span className="text-accent-cool font-semibold">intelligent knowledge repository</span>.
          Extract insights, explore connections, and let your audience discover the depth of your content.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/chat"
            className="px-8 py-4 bg-gradient-to-r from-accent-cool to-accent-warm hover:shadow-glow-cool text-primary-dark font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            💬 Start Chatting Now
          </Link>
          <Link
            href="/videos"
            className="px-8 py-4 bg-surface-dark border-2 border-accent-cool/50 hover:border-accent-cool text-text-light font-semibold text-lg rounded-xl transition-all duration-300 hover:bg-accent-cool/10"
          >
            📚 Browse Videos
          </Link>
        </div>
      </div>

      {/* Knowledge Graph Preview */}
      {!loading && graphData && graphData.nodes.length > 0 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-text-light mb-2">
              Your Knowledge Graph
            </h2>
            <p className="text-text-light/70">
              Visualizing the relationships between key concepts from your content
            </p>
          </div>
          <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface-dark shadow-2xl">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={1200}
              height={500}
              backgroundColor="#0A0F1E"
              nodeLabel="label"
              nodeColor={(node: any) => {
                if (node.has_primary) {
                  return "#10B981"; // Green for primary concepts
                } else if (node.roles && node.roles.includes("supporting")) {
                  return "#3B82F6"; // Blue for supporting
                }
                return "#79F8FF"; // Cyan fallback
              }}
              nodeVal={(node: any) => (node.mentions || 1) * 2}
              nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
                const label = node.label;
                const fontSize = 12 / globalScale;
                ctx.font = `bold ${fontSize}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                let nodeColor = "#79F8FF";
                if (node.has_primary) {
                  nodeColor = "#10B981";
                } else if (node.roles && node.roles.includes("supporting")) {
                  nodeColor = "#3B82F6";
                }

                const size = (node.mentions || 1) * 2;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = nodeColor;
                ctx.fill();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                const labelWidth = ctx.measureText(label).width;
                const labelHeight = fontSize + 4;
                const labelY = node.y + size + fontSize + 2;

                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillRect(
                  node.x - labelWidth / 2 - 2,
                  labelY - fontSize,
                  labelWidth + 4,
                  labelHeight
                );

                ctx.fillStyle = "#1f2937";
                ctx.fillText(label, node.x, labelY);
              }}
              linkColor={() => "#2D3748"}
              linkWidth={1.5}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={() => "#79F8FF"}
            />
          </div>
        </div>
      )}

      {/* Primary Concepts Section */}
      {!loading && concepts.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-text-light mb-2">
              Key Concepts from Your Content
            </h2>
            <p className="text-text-light/70">
              The most important topics extracted from your videos
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concepts.map((concept) => (
              <Link
                key={concept.concept_id}
                href={`/concepts/${concept.concept_id}`}
                className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-text-light group-hover:text-accent-cool transition-colors">
                    {concept.canonical_name}
                  </h3>
                  <span className="text-xs px-3 py-1 bg-accent-cool/20 text-accent-cool rounded-full font-medium">
                    {concept.category}
                  </span>
                </div>
                <div className="space-y-2">
                  {concept.aliases && concept.aliases.length > 0 && (
                    <p className="text-sm text-text-light/60">
                      Also: {concept.aliases.slice(0, 2).join(", ")}
                      {concept.aliases.length > 2 && "..."}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-text-light/70">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                    <span>{concept.total_mentions} mentions</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/concepts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-surface-dark border border-accent-cool/50 hover:border-accent-cool text-accent-cool font-semibold rounded-lg transition-all duration-300 hover:bg-accent-cool/10"
            >
              View All Concepts
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-light mb-2">
            Built for Content Creators
          </h2>
          <p className="text-text-light/70">
            Unlock the full potential of your video library
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              AI-Powered Chat
            </h3>
            <p className="text-text-light/70">
              Ask questions and get instant answers from your entire content library with context and timestamps.
            </p>
          </div>
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">🕸️</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              Knowledge Graph
            </h3>
            <p className="text-text-light/70">
              Visualize how concepts connect across your videos. Discover hidden relationships and themes.
            </p>
          </div>
          <div className="card border-accent-cool/30 hover:border-accent-cool/70 transition-all">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-text-light mb-2">
              Smart Discovery
            </h3>
            <p className="text-text-light/70">
              Help your audience find exactly what they need with semantic search across all your content.
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-accent-cool border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-text-light/70">Loading your knowledge base...</p>
          </div>
        </div>
      )}
    </div>
  );
}
