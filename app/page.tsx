"use client";

import { useState } from "react";
import { IncidentForm } from "@/components/IncidentForm";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalysisSchema, type Analysis, type IncidentInput } from "@/lib/schemas";
import {
  parseStreamingAnalysis,
  repairJson,
  type StreamingAnalysis,
} from "@/lib/streamParser";
import { stripMarkdownFences } from "@/lib/utils";

export default function Home() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [incident, setIncident] = useState<IncidentInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingAnalysis, setStreamingAnalysis] = useState<StreamingAnalysis | null>(null);
  // Persists after loading ends — used when the final parse fails but streaming data is good
  const [fallbackStreaming, setFallbackStreaming] = useState<StreamingAnalysis | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  async function handleSubmit(inc: IncidentInput) {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setStreamingAnalysis(null);
    setFallbackStreaming(null);
    setParseWarning(null);
    setIncident(inc);

    let lastStreaming: StreamingAnalysis | null = null;
    let parseFailed = false;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inc),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as { error?: string }).error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const safetyTriggered = res.headers.get("X-Safety-Triggered") === "true";
      const safetyReason = res.headers.get("X-Safety-Reason") ?? undefined;

      if (!res.body) throw new Error("No response body from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawText += decoder.decode(value, { stream: true });
        lastStreaming = parseStreamingAnalysis(rawText);
        setStreamingAnalysis(lastStreaming);
      }

      const rawCleaned = stripMarkdownFences(rawText);

      const parsedJson = repairJson(rawCleaned);

      if (!parsedJson) {
        parseFailed = true;
        return;
      }

      const result = AnalysisSchema.safeParse(parsedJson);
      if (!result.success) {
        parseFailed = true;
        return;
      }

      const data = result.data;

      if (safetyTriggered) {
        data.safety_escalation.triggered = true;
        if (safetyReason) data.safety_escalation.reason = safetyReason;
      }

      setAnalysis(data);
    } catch (err) {
      // Network / stream errors — show the error screen
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (parseFailed) {
        // Keep the streamed cards visible; show a non-blocking warning instead of an error
        setFallbackStreaming(lastStreaming);
        setParseWarning("Response was incomplete — showing partial results");
      }
      setIsLoading(false);
      setStreamingAnalysis(null);
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Left pane — Incident form */}
      <aside className="w-[380px] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-y-auto">
        <header className="px-5 py-4 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
          <h1 className="text-sm font-bold text-white tracking-wide">
            Production Issue Resolution
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Spokane · Tacoma · Bend
          </p>
        </header>
        <div className="p-5 flex-1">
          <IncidentForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </aside>

      {/* Right pane — Analysis results */}
      <main className="flex-1 overflow-y-auto">
        <header className="px-6 py-4 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
          <h2 className="text-sm font-bold text-white tracking-wide">Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {analysis
              ? `${analysis.hypotheses.length} hypotheses · ${
                  analysis.actions.stabilize.length +
                  analysis.actions.investigate.length +
                  analysis.actions.prevent_recurrence.length
                } actions`
              : isLoading
              ? "Retrieving context and analyzing..."
              : "Submit an incident to see analysis"}
          </p>
        </header>
        <ErrorBoundary>
          <AnalysisPanel
            analysis={analysis}
            incident={incident}
            isLoading={isLoading}
            error={error}
            streamingAnalysis={streamingAnalysis}
            fallbackStreaming={fallbackStreaming}
            parseWarning={parseWarning}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
