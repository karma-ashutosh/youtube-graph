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
  primary_count: number;
  supporting_count: number;
  mentioned_count: number;
  roles: string[];
  has_primary: boolean;
}

type RoleFilter = "all" | "primary" | "supporting" | "mentioned";

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"mentions" | "recent" | "name">(
    "mentions"
  );
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

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
    .filter((concept) => {
      if (roleFilter === "all") return true;
      if (roleFilter === "primary") return concept.has_primary;
      return concept.roles.includes(roleFilter);
    })
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
        <div className="text-lg text-text-light">Loading concepts...</div>
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
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">Concepts</h1>
        <p className="text-text-light/80 mt-2">
          Browse and explore all concepts in the knowledge graph
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search concepts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
        >
          <option value="all">All Roles</option>
          <option value="primary">Primary Only</option>
          <option value="supporting">Supporting Only</option>
          <option value="mentioned">Mentioned Only</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "mentions" | "recent" | "name")
          }
          className="px-4 py-2 border border-border-subtle rounded-lg bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
        >
          <option value="mentions">Most Mentioned</option>
          <option value="recent">Most Recent</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      <div className="text-sm text-text-light/60">
        Showing {filteredAndSortedConcepts.length} of {concepts.length} concepts
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedConcepts.map((concept) => (
          <Link
            key={concept.concept_id}
            href={`/concepts/${concept.concept_id}`}
            className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-text-light group-hover:text-accent-cool transition-colors">
                {concept.canonical_name}
              </h3>
              {concept.has_primary && (
                <span className="px-2 py-1 text-xs bg-accent-cool/20 text-accent-cool rounded border border-accent-cool/30">
                  Primary
                </span>
              )}
            </div>

            {concept.aliases.length > 0 && (
              <div className="text-sm text-text-light/60 mb-2">
                aka: {concept.aliases.slice(0, 2).join(", ")}
                {concept.aliases.length > 2 && "..."}
              </div>
            )}

            <div className="flex flex-wrap gap-1 mb-2">
              {concept.primary_count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  {concept.primary_count}× primary
                </span>
              )}
              {concept.supporting_count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                  {concept.supporting_count}× supporting
                </span>
              )}
              {concept.mentioned_count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">
                  {concept.mentioned_count}× mentioned
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="px-2 py-1 bg-accent-cool/20 text-accent-cool rounded">
                {concept.category}
              </span>
              <span className="text-text-light/60">
                {concept.total_mentions} total
              </span>
            </div>

            <div className="mt-2 text-xs text-text-light/40">
              Last mentioned:{" "}
              {new Date(concept.last_mentioned).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>

      {filteredAndSortedConcepts.length === 0 && (
        <div className="text-center text-text-light/60 py-12">
          No concepts found matching your search.
        </div>
      )}
    </div>
  );
}
