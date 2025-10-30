import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">YouTube Knowledge Graph</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Process video transcript segments and explore concepts in an interactive knowledge graph.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/upload"
          className="p-6 border rounded-lg hover:shadow-lg transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2">Upload Segments</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Import video transcript segments with AI-analyzed concepts
          </p>
        </Link>

        <Link
          href="/graph"
          className="p-6 border rounded-lg hover:shadow-lg transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2">Explore Graph</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize the knowledge graph and concept relationships
          </p>
        </Link>

        <Link
          href="/concepts"
          className="p-6 border rounded-lg hover:shadow-lg transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2">Browse Concepts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Search and filter all concepts with detailed information
          </p>
        </Link>

        <Link
          href="/query"
          className="p-6 border rounded-lg hover:shadow-lg transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-2">Query Interface</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Execute natural language or Cypher queries
          </p>
        </Link>
      </div>
    </div>
  );
}
