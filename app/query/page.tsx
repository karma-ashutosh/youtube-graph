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
        <h1 className="text-3xl font-bold">Query Interface</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Execute Cypher queries against the knowledge graph
        </p>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
          Note
        </h3>
        <p className="text-sm text-yellow-600 dark:text-yellow-300">
          This is a simplified query interface. For production use, implement proper query
          validation and rate limiting. Use the Neo4j Browser for full query capabilities.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Sample Queries (click to use)
          </label>
          <div className="space-y-2">
            {sampleQueries.map((sample, i) => (
              <button
                key={i}
                onClick={() => setQuery(sample.query)}
                className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="font-medium text-sm mb-1">{sample.label}</div>
                <code className="text-xs text-gray-600 dark:text-gray-400">
                  {sample.query}
                </code>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Cypher Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MATCH (c:Concept) RETURN c LIMIT 10"
            className="w-full h-32 p-3 border rounded-lg font-mono text-sm dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        <button
          onClick={handleExecuteQuery}
          disabled={!query || loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Executing..." : "Execute Query"}
        </button>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
            Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {results && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Results</h3>
          <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">Quick Reference</h3>
        <div className="space-y-2 text-sm">
          <div>
            <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
              MATCH (c:Concept)
            </code>{" "}
            - Match concept nodes
          </div>
          <div>
            <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
              MATCH (s:Segment)-[:DISCUSSES]-&gt;(c:Concept)
            </code>{" "}
            - Match segments and their concepts
          </div>
          <div>
            <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
              WHERE c.total_mentions &gt; 5
            </code>{" "}
            - Filter by properties
          </div>
          <div>
            <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
              RETURN c ORDER BY c.total_mentions DESC LIMIT 10
            </code>{" "}
            - Return and sort results
          </div>
        </div>
      </div>
    </div>
  );
}
