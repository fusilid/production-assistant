"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SafetyBanner } from "@/components/SafetyBanner";
import { DraftDialog } from "@/components/DraftDialog";
import type { Analysis, IncidentInput, ActionItem, Hypothesis } from "@/lib/schemas";
import {
  hasAnyStreamingData,
  type StreamingAnalysis,
  type PartialHypothesis,
  type PartialActionItem,
} from "@/lib/streamParser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DraftKind = "shift_handoff" | "maintenance_request" | "capa_outline" | "supplier_questions";

interface Props {
  analysis: Analysis | null;
  incident: IncidentInput | null;
  isLoading: boolean;
  error: string | null;
  streamingAnalysis?: StreamingAnalysis | null;
  fallbackStreaming?: StreamingAnalysis | null;
  parseWarning?: string | null;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const DRAFT_LABELS: Record<DraftKind, string> = {
  shift_handoff: "Shift Handoff",
  maintenance_request: "Maintenance Request",
  capa_outline: "CAPA Outline",
  supplier_questions: "Supplier Questions",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-red-900/60 text-red-300 border-red-700",
  medium: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  low: "bg-gray-800 text-gray-400 border-gray-600",
};

const ETA_STYLES: Record<string, string> = {
  now: "text-red-400 font-bold",
  "this shift": "text-yellow-400 font-semibold",
  "this week": "text-gray-400",
};

const ACTION_BUCKETS = [
  ["stabilize", "Stabilize", "border-red-800"],
  ["investigate", "Investigate", "border-yellow-800"],
  ["prevent_recurrence", "Prevent Recurrence", "border-blue-900"],
] as const;

// ---------------------------------------------------------------------------
// Shared card primitives
// ---------------------------------------------------------------------------

function HypothesisCard({ hyp, index }: { hyp: Hypothesis; index: number }) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="py-3 px-4 pb-0">
        <CardTitle className="flex items-start gap-2 text-sm">
          <span className="text-gray-500 font-mono text-xs mt-0.5">#{index + 1}</span>
          <span className="text-gray-100 flex-1">{hyp.summary}</span>
          <Badge
            variant="outline"
            className={`text-xs ${CONFIDENCE_STYLES[hyp.confidence] ?? ""} flex-shrink-0`}
          >
            {hyp.confidence}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-2 pb-3">
        <p className="text-xs text-gray-400 mb-2">{hyp.reasoning}</p>
        <div className="flex flex-wrap gap-1">
          {hyp.evidence.map((ev, j) => (
            <span
              key={j}
              className="text-xs bg-gray-800 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded font-mono cursor-help"
              title={`${ev.source_kind}: ${ev.note}`}
            >
              {ev.source_id}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Hypothesis card for a partially-received object — streams the CardContent live.
function StreamingHypothesisCard({ hyp, index }: { hyp: PartialHypothesis; index: number }) {
  if (!hyp.summary && !hyp.reasoning) return null;
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="py-3 px-4 pb-0">
        <CardTitle className="flex items-start gap-2 text-sm">
          <span className="text-gray-500 font-mono text-xs mt-0.5">#{index + 1}</span>
          <span className="text-gray-100 flex-1">{hyp.summary ?? "…"}</span>
          {hyp.confidence && (
            <Badge
              variant="outline"
              className={`text-xs ${CONFIDENCE_STYLES[hyp.confidence] ?? ""} flex-shrink-0`}
            >
              {hyp.confidence}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      {hyp.reasoning && (
        <CardContent className="px-4 pt-2 pb-3">
          <p className="text-xs text-gray-400">
            {hyp.reasoning}
            <span className="inline-block w-px h-3 bg-gray-500 ml-0.5 align-middle animate-pulse" />
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function ActionCard({ action }: { action: ActionItem }) {
  return (
    <div className="bg-gray-800/50 rounded p-3 border border-gray-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-100">{action.title}</p>
        <span className={`text-xs whitespace-nowrap ${ETA_STYLES[action.eta] ?? "text-gray-400"}`}>
          {action.eta}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-1">{action.detail}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        <span className="text-xs text-gray-500">Owner: {action.owner_role}</span>
        {action.linked_evidence.map((id) => (
          <span key={id} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

// Action card for a partially-received object — streams the detail line live.
function StreamingActionCard({ action }: { action: PartialActionItem }) {
  if (!action.title && !action.detail) return null;
  return (
    <div className="bg-gray-800/50 rounded p-3 border border-gray-700">
      <p className="text-sm font-semibold text-gray-100">{action.title ?? "…"}</p>
      {action.detail && (
        <p className="text-xs text-gray-400 mt-1">
          {action.detail}
          <span className="inline-block w-px h-3 bg-gray-500 ml-0.5 align-middle animate-pulse" />
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared section renderers
// ---------------------------------------------------------------------------

function HypothesesSection({
  hypotheses,
  current,
}: {
  hypotheses: Hypothesis[];
  current: PartialHypothesis | null;
}) {
  if (hypotheses.length === 0 && !current) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Root Cause Hypotheses
      </h2>
      <div className="space-y-3">
        {hypotheses.map((hyp, i) => (
          <HypothesisCard key={i} hyp={hyp} index={i} />
        ))}
        {current && (
          <StreamingHypothesisCard hyp={current} index={hypotheses.length} />
        )}
      </div>
    </section>
  );
}

function ActionsSection({
  actions,
  current,
}: {
  actions: StreamingAnalysis["actions"];
  current?: PartialActionItem | null;
}) {
  const anyConfirmed =
    actions.stabilize.length > 0 ||
    actions.investigate.length > 0 ||
    actions.prevent_recurrence.length > 0;

  if (!anyConfirmed && !current) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Action Plan
      </h2>
      <div className="space-y-4">
        {ACTION_BUCKETS.map(([key, label, border]) => {
          const confirmed = actions[key];
          const streaming = current?.bucket === key ? current : null;
          if (confirmed.length === 0 && !streaming) return null;
          return (
            <div key={key} className={`border-l-2 ${border} pl-3`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {label}
              </h3>
              <div className="space-y-2">
                {confirmed.map((action, i) => (
                  <ActionCard key={i} action={action} />
                ))}
                {streaming && <StreamingActionCard action={streaming} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty states
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">Analyzing...</div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4 bg-gray-800" />
          <Skeleton className="h-3 w-full bg-gray-800" />
          <Skeleton className="h-3 w-5/6 bg-gray-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
      <div className="text-4xl mb-4">🏭</div>
      <h3 className="text-gray-300 font-semibold text-lg mb-2">
        Production Issue Resolution Assistant
      </h3>
      <p className="text-gray-500 text-sm max-w-sm">
        Describe the issue in the form. The assistant will return ranked hypotheses with cited
        evidence, a Stabilize / Investigate / Prevent action plan, and draft artifacts.
      </p>
      <div className="mt-6 bg-gray-800/60 border border-gray-700 rounded-lg p-4 text-left max-w-sm">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Example</p>
        <p className="text-sm text-gray-300">
          &ldquo;Output dropped 18% on Tacoma Line B since 06:00, two operators report unusual
          vibration on conveyor C-12.&rdquo;
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Click &ldquo;Load example&rdquo; in the form to try it.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalysisPanel({
  analysis,
  incident,
  isLoading,
  error,
  streamingAnalysis,
  fallbackStreaming,
  parseWarning,
}: Props) {
  const [activeDraft, setActiveDraft] = useState<DraftKind | null>(null);

  // ── Live streaming view ──────────────────────────────────────────────────
  if (isLoading) {
    const hasData = streamingAnalysis != null && hasAnyStreamingData(streamingAnalysis);

    if (!hasData) {
      return <div className="p-6"><LoadingSkeleton /></div>;
    }

    return (
      <div className="p-6 space-y-5">
        <div className="w-full h-0.5 bg-blue-500/50 rounded animate-pulse" />

        {streamingAnalysis.safety_escalation?.triggered && (
          <SafetyBanner reason={streamingAnalysis.safety_escalation.reason} />
        )}

        <HypothesesSection
          hypotheses={streamingAnalysis.hypotheses}
          current={streamingAnalysis.currentHypothesis}
        />

        <ActionsSection
          actions={streamingAnalysis.actions}
          current={streamingAnalysis.currentAction}
        />
      </div>
    );
  }

  // ── Parse-failure fallback — show streamed cards + warning ───────────────
  if (!analysis && fallbackStreaming) {
    return (
      <div className="p-6 space-y-5">
        {fallbackStreaming.safety_escalation?.triggered && (
          <SafetyBanner reason={fallbackStreaming.safety_escalation.reason} />
        )}

        <HypothesesSection
          hypotheses={fallbackStreaming.hypotheses}
          current={null}
        />

        <ActionsSection actions={fallbackStreaming.actions} />

        {parseWarning && (
          <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2.5 text-xs text-yellow-400">
            <span className="mt-px shrink-0">⚠</span>
            <span>{parseWarning}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Network / unexpected error ───────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          <p className="font-semibold">Analysis failed</p>
          <p className="mt-1 text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty / initial state ────────────────────────────────────────────────
  if (!analysis || !incident) {
    return <EmptyState />;
  }

  // ── Full validated result ────────────────────────────────────────────────
  const suggestedDrafts = analysis.next_steps.suggested_drafts;

  return (
    <div className="p-6 space-y-5 overflow-auto">
      {analysis.safety_escalation.triggered && (
        <SafetyBanner reason={analysis.safety_escalation.reason} />
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Root Cause Hypotheses
        </h2>
        <div className="space-y-3">
          {analysis.hypotheses.map((hyp, i) => (
            <HypothesisCard key={i} hyp={hyp} index={i} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Action Plan
        </h2>
        <div className="space-y-4">
          {ACTION_BUCKETS.map(([key, label, border]) => {
            const items = analysis.actions[key];
            if (items.length === 0) return null;
            return (
              <div key={key} className={`border-l-2 ${border} pl-3`}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {label}
                </h3>
                <div className="space-y-2">
                  {items.map((action, i) => (
                    <ActionCard key={i} action={action} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {suggestedDrafts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Generate Drafts
          </h2>
          <div className="flex flex-wrap gap-2">
            {suggestedDrafts.map((kind) => (
              <Button
                key={kind}
                onClick={() => setActiveDraft(kind)}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 text-xs"
              >
                {DRAFT_LABELS[kind]}
              </Button>
            ))}
          </div>
        </section>
      )}

      {activeDraft && incident && (
        <DraftDialog
          kind={activeDraft}
          incident={incident}
          analysis={analysis}
          onClose={() => setActiveDraft(null)}
        />
      )}
    </div>
  );
}
