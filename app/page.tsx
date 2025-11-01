import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
          YouTube Knowledge Graph
        </h1>
        <p className="text-xl text-text-light/80 max-w-3xl mx-auto">
          Process video transcript segments and explore concepts in an interactive knowledge graph powered by AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/upload"
          className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
        >
          <h2 className="text-2xl font-semibold mb-3 text-text-light group-hover:text-accent-cool transition-colors">
            Upload Segments
          </h2>
          <p className="text-text-light/70">
            Import video transcript segments with AI-analyzed concepts
          </p>
        </Link>

        <Link
          href="/graph"
          className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
        >
          <h2 className="text-2xl font-semibold mb-3 text-text-light group-hover:text-accent-cool transition-colors">
            Explore Graph
          </h2>
          <p className="text-text-light/70">
            Visualize the knowledge graph and concept relationships
          </p>
        </Link>

        <Link
          href="/concepts"
          className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
        >
          <h2 className="text-2xl font-semibold mb-3 text-text-light group-hover:text-accent-cool transition-colors">
            Browse Concepts
          </h2>
          <p className="text-text-light/70">
            Search and filter all concepts with detailed information
          </p>
        </Link>

        <Link
          href="/query"
          className="card hover:shadow-glow-cool hover:border-accent-cool/50 transition-all duration-300 group"
        >
          <h2 className="text-2xl font-semibold mb-3 text-text-light group-hover:text-accent-cool transition-colors">
            Query Interface
          </h2>
          <p className="text-text-light/70">
            Execute natural language or Cypher queries
          </p>
        </Link>
      </div>
    </div>
  );
}
