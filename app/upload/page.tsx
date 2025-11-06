"use client";

import { useState, useEffect } from "react";
import { apiPost } from "@/lib/api-client";

export default function UploadPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
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
    setStatus(null);
    setBatchId(null);

    try {
      const data = JSON.parse(jsonInput);
      const result = await apiPost<any>("/api/segments/batch", data);
      setBatchId(result.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsProcessing(false);
    }
  };

  const handleRetry = async () => {
    if (!batchId) return;
    try {
      await apiPost<any>(`/api/segments/batch/${batchId}/retry`, {});
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  useEffect(() => {
    if (!batchId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/segments/batch/${batchId}`);
        const data = await response.json();
        setStatus(data);

        if (data.isDone) {
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [batchId]);

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

          {status && (
            <div className="card border-accent-cool bg-accent-cool/5 space-y-3">
              <h3 className="font-semibold text-accent-cool glow-text-cool">
                {status.isDone ? "Processing Complete!" : "Processing..."}
              </h3>

              {!status.isDone && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-text-light">
                    <span>Progress</span>
                    <span>{status.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-dark rounded-full h-3 border border-border-subtle">
                    <div
                      className="bg-accent-cool h-full rounded-full transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">Total</div>
                  <div className="text-2xl font-bold text-text-light">
                    {status.total}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">Completed</div>
                  <div className="text-2xl font-bold text-accent-cool">
                    {status.completed}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">Failed</div>
                  <div className="text-2xl font-bold text-accent-hot">
                    {status.failed}
                  </div>
                </div>

                <div className="bg-surface-dark p-3 rounded border border-border-subtle">
                  <div className="text-text-light/60">Pending</div>
                  <div className="text-2xl font-bold text-text-light/60">
                    {status.pending + status.processing}
                  </div>
                </div>
              </div>

              {status.failed > 0 && status.isDone && (
                <button
                  onClick={handleRetry}
                  className="btn-primary w-full"
                >
                  Retry Failed Segments ({status.failed})
                </button>
              )}

              {status.errors && status.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2 text-text-light">
                    Failed Segments:
                  </h4>
                  <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
                    {status.errors.map((err: any, i: number) => (
                      <div key={i} className="text-accent-hot">
                        Segment {err.segment_index}: {err.error}
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
