"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

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
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minMentions, setMinMentions] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [maxNodes, setMaxNodes] = useState(50);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const graphRef = useRef<any>();

  useEffect(() => {
    fetchGraphData();
  }, [minMentions, selectedCategory, maxNodes]);

  const fetchGraphData = async () => {
    try {
      const params = new URLSearchParams();
      if (minMentions > 0) params.append("minMentions", minMentions.toString());
      if (selectedCategory) params.append("category", selectedCategory);
      params.append("limit", maxNodes.toString());

      const response = await fetch(`/api/graph?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch graph data");
      }

      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeDetails = async (nodeId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/concepts/${nodeId}`);
      const data = await response.json();

      if (response.ok) {
        setNodeDetails(data);
      }
    } catch (err) {
      console.error("Error fetching node details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNodeClick = (node: any) => {
    if (node.type === "concept") {
      setSelectedNode(node);
      fetchNodeDetails(node.id);
    }
  };

  const closeSidePanel = () => {
    setSelectedNode(null);
    setNodeDetails(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading graph...</div>
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
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-3xl font-bold">Knowledge Graph</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Interactive visualization of concept relationships. Click any node to see details.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Min Mentions: {minMentions}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={minMentions}
            onChange={(e) => setMinMentions(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Max Nodes: {maxNodes}
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={maxNodes}
            onChange={(e) => setMaxNodes(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Marketing">Marketing</option>
            <option value="Business">Business</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchGraphData}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {graphData && (
        <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
          <div className="text-sm text-gray-600 dark:text-gray-400 p-3 border-b bg-white dark:bg-gray-800">
            Showing {graphData.nodes.length} nodes and {graphData.links.length}{" "}
            links. Click on a concept to view details.
          </div>

          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={1200}
            height={700}
            backgroundColor="#f8f9fa"
            nodeLabel="label"
            nodeColor={(node: any) => {
              // Vibrant colors by category with good contrast
              const colors: { [key: string]: string } = {
                Product: "#2563eb",      // Bright blue
                Marketing: "#059669",    // Emerald green
                Business: "#dc2626",     // Red
                Uncategorized: "#7c3aed", // Purple
              };
              return colors[node.category || "Uncategorized"] || "#7c3aed";
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

              // Get color from nodeColor function
              const colors: { [key: string]: string } = {
                Product: "#2563eb",
                Marketing: "#059669",
                Business: "#dc2626",
                Uncategorized: "#7c3aed",
              };
              const nodeColor = colors[node.category || "Uncategorized"] || "#7c3aed";

              // Draw node circle with border
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
            }}
            onNodeClick={handleNodeClick}
            linkColor={() => "#94a3b8"}
            linkWidth={1.5}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#64748b"}
          />
        </div>
      )}

      {graphData && graphData.nodes.length === 0 && (
        <div className="text-center text-gray-600 dark:text-gray-400 py-12">
          No data to display. Try adjusting the filters or upload some segments
          first.
        </div>
      )}

      {/* Side Panel */}
      {selectedNode && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto z-50">
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold">{selectedNode.label}</h2>
              <button
                onClick={closeSidePanel}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600 dark:text-gray-400">Loading details...</div>
              </div>
            ) : nodeDetails ? (
              <div className="space-y-4">
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

                {/* Actions */}
                <div className="pt-4 space-y-2">
                  <a
                    href={`/concepts/${selectedNode.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Full Details →
                  </a>
                  <button
                    onClick={closeSidePanel}
                    className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-center rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-600 dark:text-gray-400">
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
