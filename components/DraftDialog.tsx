"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IncidentInput, Analysis } from "@/lib/schemas";

type DraftKind = "shift_handoff" | "maintenance_request" | "capa_outline" | "supplier_questions";

const DRAFT_LABELS: Record<DraftKind, string> = {
  shift_handoff: "Shift Handoff Note",
  maintenance_request: "Maintenance Request",
  capa_outline: "CAPA Outline",
  supplier_questions: "Supplier Questions",
};

interface Props {
  kind: DraftKind | null;
  incident: IncidentInput;
  analysis: Analysis;
  onClose: () => void;
}

export function DraftDialog({ kind, incident, analysis, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateDraft = useCallback(async () => {
    if (!kind) return;
    setIsLoading(true);
    setError(null);
    setDraft("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, incident, analysis }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { draft: string };
      setDraft(data.draft);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [kind, incident, analysis]);

  // Auto-generate when dialog opens
  useEffect(() => {
    if (kind) generateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={!!kind} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            {kind ? DRAFT_LABELS[kind] : ""}{" "}
            <span className="text-yellow-400 text-sm font-normal">[DRAFT — Review before use]</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col gap-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
              <span className="animate-spin">⏳</span> Generating draft...
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-red-300 text-sm">
              {error}
              <button
                onClick={generateDraft}
                className="block mt-2 text-red-400 underline text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {draft && (
            <>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="bg-gray-950 border-gray-700 text-gray-100 text-sm font-mono min-h-[350px] resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
                >
                  {copied ? "Copied!" : "Copy to clipboard"}
                </Button>
                <Button
                  onClick={generateDraft}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
                >
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
