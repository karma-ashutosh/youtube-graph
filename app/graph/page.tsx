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
  const graphRef = useRef<any>();

  useEffect(() => {
    fetchGraphData();
  }, [minMentions, selectedCategory]);

  const fetchGraphData = async () => {
    try {
      const params = new URLSearchParams();
      if (minMentions > 0) params.append("minMentions", minMentions.toString());
      if (selectedCategory) params.append("category", selectedCategory);

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

  const handleNodeClick = (node: any) => {
    if (node.type === "concept") {
      window.location.href = `/concepts/${node.id}`;
    }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Knowledge Graph</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Interactive visualization of concept relationships
        </p>
      </div>

      <div className="flex gap-4 items-center">
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
            className="w-48"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Marketing">Marketing</option>
            <option value="Business">Business</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <button
          onClick={fetchGraphData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
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
    </div>
  );
}
