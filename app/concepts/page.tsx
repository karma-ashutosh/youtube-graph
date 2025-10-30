"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Concept {
  concept_id: string;
  canonical_name: string;
  aliases: string[];
  category: string;
  total_mentions: number;
  importance_score: number;
  first_mentioned: string;
  last_mentioned: string;
}

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"mentions" | "recent" | "name">(
    "mentions"
  );

  useEffect(() => {
    fetchConcepts();
  }, []);

  const fetchConcepts = async () => {
    try {
      const response = await fetch("/api/concepts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch concepts");
      }

      setConcepts(data.concepts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedConcepts = concepts
    .filter(
      (concept) =>
        concept.canonical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        concept.aliases.some((alias) =>
          alias.toLowerCase().includes(searchTerm.toLowerCase())
        )
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "mentions":
          return b.total_mentions - a.total_mentions;
        case "recent":
          return (
            new Date(b.last_mentioned).getTime() -
            new Date(a.last_mentioned).getTime()
          );
        case "name":
          return a.canonical_name.localeCompare(b.canonical_name);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading concepts...</div>
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
        <h1 className="text-3xl font-bold">Concepts</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Browse and explore all concepts in the knowledge graph
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search concepts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "mentions" | "recent" | "name")
          }
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="mentions">Most Mentioned</option>
          <option value="recent">Most Recent</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAndSortedConcepts.length} of {concepts.length} concepts
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedConcepts.map((concept) => (
          <Link
            key={concept.concept_id}
            href={`/concepts/${concept.concept_id}`}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-2">
              {concept.canonical_name}
            </h3>

            {concept.aliases.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                aka: {concept.aliases.slice(0, 2).join(", ")}
                {concept.aliases.length > 2 && "..."}
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {concept.category}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {concept.total_mentions} mentions
              </span>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Last mentioned:{" "}
              {new Date(concept.last_mentioned).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>

      {filteredAndSortedConcepts.length === 0 && (
        <div className="text-center text-gray-600 dark:text-gray-400 py-12">
          No concepts found matching your search.
        </div>
      )}
    </div>
  );
}
