import type { IncidentInput } from "@/lib/schemas";
import type { RetrievedStandard } from "@/lib/context/standards";
import type { RetrievedIncident } from "@/lib/context/incidents";
import type { RetrievedMaintenanceRecord } from "@/lib/context/maintenance";
import type { RetrievedQualityThreshold } from "@/lib/context/quality";
import type { SafetyEscalationResult } from "@/lib/safety";

interface ContextBundle {
  standards: RetrievedStandard[];
  incidents: RetrievedIncident[];
  maintenance: RetrievedMaintenanceRecord[];
  quality: RetrievedQualityThreshold[];
  safetyResult: SafetyEscalationResult;
}

export function buildAnalysisPrompt(
  incident: IncidentInput,
  ctx: ContextBundle
): { system: string; user: string } {
  const system = `You are an experienced manufacturing engineer and reliability lead advising a shift plant manager who is handling an active production issue right now. They need answers in the next 10 minutes — be direct, specific, and evidence-based.

HARD RULES — you must follow all of these without exception:

1. HYPOTHESES, NOT VERDICTS: Always return 2 to 4 hypotheses ranked by confidence. Never assert a single definitive root cause. Use confidence levels: "high", "medium", or "low". Overconfidence causes real damage (incorrect line shutdowns, wrong supplier blame, missed safety issues).

2. CITE OR DON'T CLAIM: Every hypothesis, every piece of reasoning, and every action must cite a source_id from the retrieved context below. If you want to make a claim with no basis in the provided context, you must explicitly say "no supporting evidence in current context" rather than inventing or hallucinating a citation.

3. STABILIZE / INVESTIGATE / PREVENT RECURRENCE: Your actions must use exactly these three buckets, in exactly this order. Stabilize = stop the bleeding now. Investigate = what to check next to confirm or rule out hypotheses. Prevent recurrence = systemic fix. Do not collapse them, rename them, or invent new categories.

4. SAFETY FIRST: ${ctx.safetyResult.triggered ? `⚠️ SAFETY ESCALATION TRIGGERED. Matched terms: ${ctx.safetyResult.matchedTerms.join(", ")}. Your response MUST lead with safety actions in the Stabilize bucket. Frame all analysis around ensuring personnel safety before production recovery.` : "No safety keywords detected. Standard analysis applies."}

5. OUTPUT FORMAT: Return ONLY valid JSON matching the schema specified in the user message. No commentary before or after the JSON block.`;

  const contextBlock = buildContextBlock(ctx);

  const outputSchema = `{
  "safety_escalation": {
    "triggered": boolean,
    "reason": string | undefined
  },
  "hypotheses": [  // 2-4 items, ranked most likely first
    {
      "summary": "One sentence summary of this hypothesis",
      "confidence": "high" | "medium" | "low",
      "reasoning": "Explanation of why this is plausible, citing evidence",
      "evidence": [
        {
          "source_id": "STD-001 or INC-2024-001 or WO-8821 or QT-BEARING-VIB or user_log",
          "source_kind": "standard" | "incident" | "maintenance" | "quality" | "user_log",
          "note": "What this source tells us about this hypothesis"
        }
      ]
    }
  ],
  "actions": {
    "stabilize": [ActionItem],
    "investigate": [ActionItem],
    "prevent_recurrence": [ActionItem]
  },
  "next_steps": {
    "suggested_drafts": ["shift_handoff", "maintenance_request", "capa_outline", "supplier_questions"]
    // Include only the draft types that are genuinely relevant to this incident
  }
}

Where ActionItem is:
{
  "title": "Short imperative title",
  "detail": "Specific instructions — who, what, exactly how",
  "owner_role": "shift supervisor" | "maintenance tech" | "quality lead" | "EHS lead" | "plant manager" | "supplier quality",
  "eta": "now" | "this shift" | "this week",
  "linked_evidence": ["STD-001", "INC-2024-001"]  // source_ids this action is based on
}`;

  const user = `INCIDENT REPORT:
Plant: ${incident.plant_id}
Line: ${incident.line_id}
Timeframe: ${incident.timeframe.start} to ${incident.timeframe.end}
Problem Statement: ${incident.problem_statement}
${incident.logs ? `\nOperator Logs / Additional Data:\n${incident.logs}` : ""}
${incident.notes ? `\nAdditional Notes: ${incident.notes}` : ""}

${contextBlock}

Analyze this incident and return a JSON response matching this exact schema:

${outputSchema}

Remember: return ONLY the JSON object, no markdown fences, no commentary.`;

  return { system, user };
}

function buildContextBlock(ctx: ContextBundle): string {
  const sections: string[] = ["RETRIEVED CONTEXT (cite source_ids in your response):"];

  if (ctx.standards.length > 0) {
    sections.push("\n--- PROCESS STANDARDS ---");
    for (const std of ctx.standards) {
      sections.push(
        `[${std.source_id}] ${std.title}\n  Summary: ${std.summary}${std.thresholds ? `\n  Key thresholds: ${JSON.stringify(std.thresholds)}` : ""}\n  Ref: ${std.reference}`
      );
    }
  }

  if (ctx.incidents.length > 0) {
    sections.push("\n--- PRIOR INCIDENTS (same plant/line) ---");
    for (const inc of ctx.incidents) {
      sections.push(
        `[${inc.source_id}] ${inc.date} — ${inc.title}${inc.recurrence ? " [RECURRENCE]" : ""}\n  What happened: ${inc.description}\n  Root cause: ${inc.root_cause}\n  Resolution: ${inc.resolution}${inc.duration_minutes ? `\n  Downtime: ${inc.duration_minutes} min` : ""}`
      );
    }
  }

  if (ctx.maintenance.length > 0) {
    sections.push("\n--- MAINTENANCE RECORDS ---");
    for (const rec of ctx.maintenance) {
      if (rec.type === "asset") {
        sections.push(
          `[${rec.source_id}] ASSET: ${rec.asset_name}\n  ${rec.description}\n  ${rec.notes}`
        );
      } else {
        sections.push(
          `[${rec.source_id}] WORK ORDER: ${rec.asset_name} — ${rec.description}\n  Scheduled: ${rec.scheduled_date} | Completed: ${rec.completed_date ?? "NOT COMPLETED"}\n  Notes: ${rec.notes}${rec.parts_used && rec.parts_used.length > 0 ? `\n  Parts: ${rec.parts_used.map((p) => `${p.part_no} x${p.qty} (lot: ${p.lot}, supplier: ${p.supplier})`).join(", ")}` : ""}`
        );
      }
    }
  }

  if (ctx.quality.length > 0) {
    sections.push("\n--- QUALITY THRESHOLDS ---");
    for (const qt of ctx.quality) {
      sections.push(
        `[${qt.source_id}] ${qt.category}\n  Measurement: ${qt.measurement}\n  Thresholds: ${JSON.stringify(qt.thresholds)}${qt.cpk_target ? `\n  Cpk target: ${qt.cpk_target}, hold at: ${qt.cpk_hold}` : ""}${qt.typical_root_causes ? `\n  Typical root causes: ${qt.typical_root_causes.join(", ")}` : ""}`
      );
    }
  }

  return sections.join("\n");
}
