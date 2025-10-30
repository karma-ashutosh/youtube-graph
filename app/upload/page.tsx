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
        <h1 className="text-3xl font-bold">Upload Segments</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload video transcript segments with AI-analyzed concepts to build
          the knowledge graph.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload JSON File
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
              />
            </div>

            <div className="text-center text-gray-500">or</div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Paste JSON Data
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your segment data JSON here..."
                className="w-full h-64 p-3 border rounded-lg font-mono text-sm dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!jsonInput || isProcessing}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "Processing..." : "Ingest Segments"}
            </button>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold mb-2">Expected Format</h3>
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
            <div className="border border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                Error
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          {results && (
            <div className="border border-green-500 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-green-700 dark:text-green-400">
                Processing Complete!
              </h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-gray-600 dark:text-gray-400">
                    Total Segments
                  </div>
                  <div className="text-2xl font-bold">
                    {results.totalSegments}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-gray-600 dark:text-gray-400">
                    Successful
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {results.successfulSegments}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-gray-600 dark:text-gray-400">Failed</div>
                  <div className="text-2xl font-bold text-red-600">
                    {results.failedSegments}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-gray-600 dark:text-gray-400">
                    Concepts Processed
                  </div>
                  <div className="text-2xl font-bold">
                    {results.totalConceptsProcessed}
                  </div>
                </div>
              </div>

              {results.errors && results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Errors:</h4>
                  <div className="space-y-1 text-sm">
                    {results.errors.map((err: any, i: number) => (
                      <div key={i} className="text-red-600 dark:text-red-400">
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
