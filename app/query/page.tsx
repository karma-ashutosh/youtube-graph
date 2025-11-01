"use client";

import { useState } from "react";

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    {
      label: "Get all concepts with >5 mentions",
      query: "MATCH (c:Concept) WHERE c.total_mentions > 5 RETURN c ORDER BY c.total_mentions DESC LIMIT 10",
    },
    {
      label: "Find segments about a specific concept",
      query: "MATCH (s:Segment)-[d:DISCUSSES]->(c:Concept {canonical_name: 'Product-Market Fit'}) RETURN s, d, c",
    },
    {
      label: "Get concept relationships",
      query: "MATCH (c1:Concept)-[r:RELATED_TO]-(c2:Concept) RETURN c1.canonical_name, c2.canonical_name, r.strength LIMIT 20",
    },
  ];

  const handleExecuteQuery = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    // For now, we'll just show a message that this feature needs Neo4j query execution
    // In production, you'd want to create an API endpoint that safely executes Cypher queries
    setError(
      "Direct Cypher query execution is not implemented in this demo. " +
      "To enable this feature, create an API endpoint at /api/query that safely executes Cypher queries. " +
      "For now, you can use the Neo4j Browser or connect directly to your Neo4j instance."
    );
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">Query Interface</h1>
        <p className="text-text-light/80 mt-2">
          Execute Cypher queries against the knowledge graph
        </p>
      </div>

      <div className="card border-accent-cool/50 bg-accent-cool/5">
        <h3 className="font-semibold text-accent-cool mb-2">
          Note
        </h3>
        <p className="text-sm text-text-light/70">
          This is a simplified query interface. For production use, implement proper query
          validation and rate limiting. Use the Neo4j Browser for full query capabilities.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-text-light">
            Sample Queries (click to use)
          </label>
          <div className="space-y-2">
            {sampleQueries.map((sample, i) => (
              <button
                key={i}
                onClick={() => setQuery(sample.query)}
                className="w-full text-left p-3 card hover:border-accent-cool/50 transition-all duration-300"
              >
                <div className="font-medium text-sm mb-1 text-text-light">{sample.label}</div>
                <code className="text-xs text-text-light/60">
                  {sample.query}
                </code>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-light">
            Cypher Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MATCH (c:Concept) RETURN c LIMIT 10"
            className="w-full h-32 p-3 border border-border-subtle rounded-lg font-mono text-sm bg-surface-dark text-text-light focus:outline-none focus:border-accent-cool"
          />
        </div>

        <button
          onClick={handleExecuteQuery}
          disabled={!query || loading}
          className="btn-primary disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? "Executing..." : "Execute Query"}
        </button>
      </div>

      {error && (
        <div className="card border-accent-hot bg-accent-hot/10">
          <h3 className="font-semibold text-accent-hot mb-2 glow-text-hot">
            Error
          </h3>
          <p className="text-sm text-text-light/80">{error}</p>
        </div>
      )}

      {results && (
        <div className="card">
          <h3 className="font-semibold mb-3 text-text-light">Results</h3>
          <pre className="bg-primary-dark p-4 rounded text-sm overflow-x-auto text-text-light border border-border-subtle">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div className="card bg-surface-dark">
        <h3 className="font-semibold mb-3 text-text-light">Quick Reference</h3>
        <div className="space-y-2 text-sm text-text-light/70">
          <div>
            <code className="text-xs bg-primary-dark px-2 py-1 rounded text-accent-cool border border-border-subtle">
              MATCH (c:Concept)
            </code>{" "}
            - Match concept nodes
          </div>
          <div>
            <code className="text-xs bg-primary-dark px-2 py-1 rounded text-accent-cool border border-border-subtle">
              MATCH (s:Segment)-[:DISCUSSES]-&gt;(c:Concept)
            </code>{" "}
            - Match segments and their concepts
          </div>
          <div>
            <code className="text-xs bg-primary-dark px-2 py-1 rounded text-accent-cool border border-border-subtle">
              WHERE c.total_mentions &gt; 5
            </code>{" "}
            - Filter by properties
          </div>
          <div>
            <code className="text-xs bg-primary-dark px-2 py-1 rounded text-accent-cool border border-border-subtle">
              RETURN c ORDER BY c.total_mentions DESC LIMIT 10
            </code>{" "}
            - Return and sort results
          </div>
        </div>
      </div>
    </div>
  );
}
