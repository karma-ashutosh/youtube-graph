"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api-client";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    mentions?: number;
    importance?: number;
    category?: string;
    duration?: number;
    roles?: string[];
    has_primary?: boolean;
    primary_count?: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
    role?: string;
  }>;
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minMentions, setMinMentions] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [maxNodes, setMaxNodes] = useState(50);
  const [includeSegments, setIncludeSegments] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const graphRef = useRef<any>();

  useEffect(() => {
    fetchGraphData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMentions, selectedCategory, maxNodes, includeSegments, roleFilter]);

  const fetchGraphData = async () => {
    try {
      const params = new URLSearchParams();
      if (minMentions > 0) params.append("minMentions", minMentions.toString());
      if (selectedCategory) params.append("category", selectedCategory);
      if (roleFilter) params.append("roleFilter", roleFilter);
      params.append("limit", maxNodes.toString());
      params.append("includeSegments", includeSegments.toString());

      const data = await apiGet<GraphData>(`/api/graph?${params}`);
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeDetails = async (nodeId: string, nodeType: string) => {
    setLoadingDetails(true);
    try {
      const endpoint = nodeType === "segment" ? `/api/segments/${nodeId}` : `/api/concepts/${nodeId}`;
      const data = await apiGet<any>(endpoint);
      setNodeDetails(data);
    } catch (err) {
      console.error("Error fetching node details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    fetchNodeDetails(node.id, node.type);
  };

  const closeSidePanel = () => {
    setSelectedNode(null);
    setNodeDetails(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-text-light">Loading graph...</div>
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
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">Knowledge Graph</h1>
        <p className="text-text-light/80 mt-2">
          Interactive visualization of concept relationships. Click any node to see details.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-text-light">
            Min Mentions: {minMentions}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={minMentions}
            onChange={(e) => setMinMentions(parseInt(e.target.value))}
            className="w-full accent-accent-cool"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-text-light">
            Max Nodes: {maxNodes}
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={maxNodes}
            onChange={(e) => setMaxNodes(parseInt(e.target.value))}
            className="w-full accent-accent-cool"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-text-light">Role Filter</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
          >
            <option value="all">All Roles</option>
            <option value="primary">Primary Only</option>
            <option value="supporting">Supporting Only</option>
            <option value="mentioned">Mentioned Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-text-light">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
          >
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Marketing">Marketing</option>
            <option value="Business">Business</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeSegments}
              onChange={(e) => setIncludeSegments(e.target.checked)}
              className="mr-2 w-4 h-4 accent-accent-cool"
            />
            <span className="text-sm font-medium text-text-light">Show Segments</span>
          </label>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchGraphData}
            className="btn-secondary w-full"
          >
            Refresh
          </button>
        </div>
      </div>

      {graphData && (
        <div className="border border-border-subtle rounded-lg overflow-hidden bg-primary-dark">
          <div className="text-sm text-text-light/80 p-3 border-b border-border-subtle bg-surface-dark flex justify-between items-center">
            <div>
              Showing {graphData.nodes.length} nodes and {graphData.links.length}{" "}
              links. Click on a concept to view details.
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Primary</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Supporting</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span>Mentioned</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500"></div>
                <span>Segment</span>
              </div>
            </div>
          </div>

          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={1200}
            height={700}
            backgroundColor="#060A14"
            nodeLabel="label"
            nodeColor={(node: any) => {
              // Segment nodes (amber/orange)
              if (node.type === "segment") {
                return "#f59e0b";
              }

              // Concept nodes - color by role
              if (node.has_primary) {
                return "#10B981"; // Green for primary concepts (fully explained)
              } else if (node.roles && node.roles.includes("supporting")) {
                return "#3B82F6"; // Blue for supporting-only concepts
              } else if (node.roles && node.roles.includes("mentioned")) {
                return "#6B7280"; // Gray for mentioned-only concepts
              }

              // Fallback
              return "#79F8FF"; // Cyan
            }}
            nodeVal={(node: any) => {
              // Size by mentions
              return (node.mentions || 1) * 2;
            }}
            nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
              const label = node.label;
              const fontSize = 12 / globalScale;
              ctx.font = `bold ${fontSize}px Sans-Serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              if (node.type === "segment") {
                // Draw segment as rectangle
                const size = 8;
                const rectWidth = size * 2;
                const rectHeight = size * 1.5;

                ctx.fillStyle = "#f59e0b"; // Amber color for segments
                ctx.fillRect(
                  node.x - rectWidth / 2,
                  node.y - rectHeight / 2,
                  rectWidth,
                  rectHeight
                );

                // Add white border
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(
                  node.x - rectWidth / 2,
                  node.y - rectHeight / 2,
                  rectWidth,
                  rectHeight
                );

                // Draw label with white background for readability
                const labelWidth = ctx.measureText(label).width;
                const labelHeight = fontSize + 4;
                const labelY = node.y + rectHeight / 2 + fontSize + 2;

                // Background for label
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillRect(
                  node.x - labelWidth / 2 - 2,
                  labelY - fontSize,
                  labelWidth + 4,
                  labelHeight
                );

                // Label text
                ctx.fillStyle = "#1f2937";
                ctx.fillText(label, node.x, labelY);
              } else {
                // Draw concept as circle - color by role
                let nodeColor = "#79F8FF"; // Fallback cyan
                if (node.has_primary) {
                  nodeColor = "#10B981"; // Green for primary concepts
                } else if (node.roles && node.roles.includes("supporting")) {
                  nodeColor = "#3B82F6"; // Blue for supporting-only
                } else if (node.roles && node.roles.includes("mentioned")) {
                  nodeColor = "#6B7280"; // Gray for mentioned-only
                }

                const size = (node.mentions || 1) * 2;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = nodeColor;
                ctx.fill();

                // Add white border for better visibility
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Draw label with white background for readability
                const labelWidth = ctx.measureText(label).width;
                const labelHeight = fontSize + 4;
                const labelY = node.y + size + fontSize + 2;

                // Background for label
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillRect(
                  node.x - labelWidth / 2 - 2,
                  labelY - fontSize,
                  labelWidth + 4,
                  labelHeight
                );

                // Label text
                ctx.fillStyle = "#1f2937";
                ctx.fillText(label, node.x, labelY);
              }
            }}
            onNodeClick={handleNodeClick}
            linkColor={() => "#2D3748"}
            linkWidth={1.5}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#79F8FF"}
          />
        </div>
      )}

      {graphData && graphData.nodes.length === 0 && (
        <div className="text-center text-text-light/60 py-12">
          No data to display. Try adjusting the filters or upload some segments
          first.
        </div>
      )}

      {/* Side Panel */}
      {selectedNode && (
        <div className="fixed right-0 top-0 h-full w-96 bg-surface-dark shadow-glow-cool border-l border-border-subtle overflow-y-auto z-50">
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-text-light">{selectedNode.label}</h2>
                <span className="text-xs px-2 py-1 bg-accent-cool/20 text-accent-cool rounded mt-1 inline-block">
                  {selectedNode.type}
                </span>
              </div>
              <button
                onClick={closeSidePanel}
                className="text-text-light/60 hover:text-accent-cool transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-text-light/60">Loading details...</div>
              </div>
            ) : nodeDetails ? (
              <div className="space-y-4">
                {selectedNode.type === "segment" ? (
                  // Segment Details
                  <>
                    {/* Video Info */}
                    {nodeDetails.video && (
                      <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Video</div>
                        <a
                          href={nodeDetails.video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Watch on YouTube →
                        </a>
                      </div>
                    )}

                    {/* Time Info */}
                    {nodeDetails.segment && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                          <div className="text-xs text-gray-600 dark:text-gray-400">Duration</div>
                          <div className="text-sm font-semibold">{nodeDetails.segment.duration_seconds}s</div>
                        </div>
                        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                          <div className="text-xs text-gray-600 dark:text-gray-400">Time Range</div>
                          <div className="text-xs font-semibold">
                            {nodeDetails.segment.start_time} - {nodeDetails.segment.end_time}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Concepts */}
                    {nodeDetails.concepts && nodeDetails.concepts.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Concepts Discussed ({nodeDetails.concepts.length})
                        </div>
                        <div className="space-y-2">
                          {nodeDetails.concepts.slice(0, 3).map((item: any, i: number) => {
                            const concept = item.concept?.properties;
                            if (!concept) return null;
                            return (
                              <div key={i} className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-900 text-sm">
                                <div className="font-medium">{concept.canonical_name}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Role: {item.discusses?.properties?.role || "N/A"}
                                </div>
                              </div>
                            );
                          })}
                          {nodeDetails.concepts.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{nodeDetails.concepts.length - 3} more concepts
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Examples */}
                    {nodeDetails.examples && nodeDetails.examples.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Examples ({nodeDetails.examples.length})
                        </div>
                        <div className="border-l-4 border-purple-500 pl-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 rounded">
                          {nodeDetails.examples[0].example_text.substring(0, 100)}
                          {nodeDetails.examples[0].example_text.length > 100 ? "..." : ""}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Concept Details
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Category</div>
                        <div className="text-sm font-semibold">{nodeDetails.concept.category}</div>
                      </div>
                      <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Mentions</div>
                        <div className="text-sm font-semibold">{nodeDetails.concept.total_mentions}</div>
                      </div>
                    </div>

                    {/* Aliases */}
                    {nodeDetails.concept.aliases && nodeDetails.concept.aliases.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Also known as
                        </div>
                        <div className="text-sm">{nodeDetails.concept.aliases.join(", ")}</div>
                      </div>
                    )}

                    {/* Key Segment */}
                    {nodeDetails.segments && nodeDetails.segments.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Featured In ({nodeDetails.segments.length} segments)
                        </div>
                        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900 space-y-2">
                          {nodeDetails.segments.slice(0, 2).map((item: any, i: number) => {
                            const seg = item.segment?.properties;
                            if (!seg) return null;
                            return (
                              <div key={i} className="text-sm">
                                <div className="font-medium truncate">{seg.topic_hint}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {seg.start_time} - {seg.end_time}
                                </div>
                              </div>
                            );
                          })}
                          {nodeDetails.segments.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{nodeDetails.segments.length - 2} more segments
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Examples Preview */}
                    {nodeDetails.examples && nodeDetails.examples.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Examples ({nodeDetails.examples.length})
                        </div>
                        <div className="border-l-4 border-blue-500 pl-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 rounded">
                          {nodeDetails.examples[0].example_text.substring(0, 150)}
                          {nodeDetails.examples[0].example_text.length > 150 ? "..." : ""}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="pt-4 space-y-2">
                  <a
                    href={selectedNode.type === "segment" ? `/segments/${selectedNode.id}` : `/concepts/${selectedNode.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary block text-center"
                  >
                    View Full Details →
                  </a>
                  <button
                    onClick={closeSidePanel}
                    className="btn-secondary block w-full"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-text-light/60">
                Unable to load details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay when side panel is open */}
      {selectedNode && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={closeSidePanel}
        />
      )}
    </div>
  );
}
