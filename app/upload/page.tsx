"use client";

import { useState } from "react";

export default function UploadPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const data = JSON.parse(jsonInput);

      const response = await fetch("/api/segments/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to ingest segments");
      }

      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">Upload Segments</h1>
        <p className="text-text-light/80 mt-2">
          Upload video transcript segments with AI-analyzed concepts to build
          the knowledge graph.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-text-light">
                Upload JSON File
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-text-light border border-border-subtle rounded-lg cursor-pointer bg-surface-dark focus:outline-none focus:border-accent-cool"
              />
            </div>

            <div className="text-center text-text-light/50">or</div>

            <div>
              <label className="block text-sm font-medium mb-2 text-text-light">
                Paste JSON Data
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your segment data JSON here..."
                className="w-full h-64 p-3 border border-border-subtle rounded-lg font-mono text-sm bg-primary-dark text-text-light focus:outline-none focus:border-accent-cool"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!jsonInput || isProcessing}
              className="btn-primary w-full disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isProcessing ? "Processing..." : "Ingest Segments"}
            </button>
          </div>

          <div className="card bg-primary-dark">
            <h3 className="font-semibold mb-2 text-text-light">Expected Format</h3>
            <pre className="text-xs overflow-x-auto">
              {`[
  {
    "video_url": "https://youtube.com/watch?v=...",
    "start_time": "00:03:54",
    "end_time": "00:04:42",
    "topic_hint": "Marketing tactics",
    "analysis_json": "{\\"primary_concept\\":...}",
    "id": null,
    "created_at": null,
    "updated_at": null
  }
]`}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="card border-accent-hot bg-accent-hot/10">
              <h3 className="font-semibold text-accent-hot mb-2 glow-text-hot">
                Error
              </h3>
              <p className="text-sm text-text-light/80">{error}</p>
            </div>
          )}

          {results && (
            <div className="card border-accent-cool bg-accent-cool/5 space-y-3">
              <h3 className="font-semibold text-accent-cool glow-text-cool">
                Processing Complete!
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">
                    Total Segments
                  </div>
                  <div className="text-2xl font-bold text-text-light">
                    {results.totalSegments}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">
                    Successful
                  </div>
                  <div className="text-2xl font-bold text-accent-cool">
                    {results.successfulSegments}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">Failed</div>
                  <div className="text-2xl font-bold text-accent-hot">
                    {results.failedSegments}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">
                    Concepts Processed
                  </div>
                  <div className="text-2xl font-bold text-text-light">
                    {results.totalConceptsProcessed}
                  </div>
                </div>
              </div>

              {results.errors && results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2 text-text-light">Errors:</h4>
                  <div className="space-y-1 text-sm">
                    {results.errors.map((err: any, i: number) => (
                      <div key={i} className="text-accent-hot">
                        {err.segmentId}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
