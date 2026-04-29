import type { IncidentInput, Analysis } from "@/lib/schemas";

type DraftKind =
  | "shift_handoff"
  | "maintenance_request"
  | "capa_outline"
  | "supplier_questions";

function buildEvidenceSummary(analysis: Analysis): string {
  const evidenceIds = new Set<string>();
  for (const hyp of analysis.hypotheses) {
    for (const ev of hyp.evidence) evidenceIds.add(ev.source_id);
  }
  for (const bucket of Object.values(analysis.actions)) {
    for (const action of bucket) {
      for (const id of action.linked_evidence) evidenceIds.add(id);
    }
  }
  return Array.from(evidenceIds).join(", ");
}

function buildHypothesisSummary(analysis: Analysis): string {
  return analysis.hypotheses
    .map(
      (h, i) =>
        `${i + 1}. [${h.confidence.toUpperCase()}] ${h.summary} (evidence: ${h.evidence.map((e) => e.source_id).join(", ")})`
    )
    .join("\n");
}

function buildActionSummary(analysis: Analysis): string {
  const lines: string[] = [];
  const all = [
    ...analysis.actions.stabilize.map((a) => ({ ...a, bucket: "STABILIZE" })),
    ...analysis.actions.investigate.map((a) => ({ ...a, bucket: "INVESTIGATE" })),
    ...analysis.actions.prevent_recurrence.map((a) => ({ ...a, bucket: "PREVENT" })),
  ];
  for (const a of all) {
    lines.push(`[${a.bucket}] ${a.title} (owner: ${a.owner_role}, eta: ${a.eta})`);
  }
  return lines.join("\n");
}

export function buildDraftPrompt(
  kind: DraftKind,
  incident: IncidentInput,
  analysis: Analysis
): string {
  const hypSummary = buildHypothesisSummary(analysis);
  const actionSummary = buildActionSummary(analysis);
  const evidenceIds = buildEvidenceSummary(analysis);

  const context = `INCIDENT CONTEXT:
Plant: ${incident.plant_id} | Line: ${incident.line_id}
Timeframe: ${incident.timeframe.start} to ${incident.timeframe.end}
Problem: ${incident.problem_statement}
${incident.logs ? `Operator logs: ${incident.logs}` : ""}

ANALYSIS RESULTS:
Hypotheses (ranked):
${hypSummary}

Actions:
${actionSummary}

Evidence cited: ${evidenceIds}
Safety escalation: ${analysis.safety_escalation.triggered ? `YES — ${analysis.safety_escalation.reason}` : "No"}`;

  switch (kind) {
    case "shift_handoff":
      return `${context}

Generate a shift handoff note for the incoming shift manager. This is a terse, bulleted note — not prose. The incoming manager is busy; they need facts, not sentences.

Required sections:
SITUATION: What happened, what line, when it started
STATUS: Current state of the line (running/stopped/degraded, current throughput)
WHAT WAS TRIED: Actions taken this shift with outcomes
OPEN ITEMS: What still needs to be done (cite specific actions and owners from the analysis)
ESCALATION CONTACTS: Who to call and for what
NEXT SHIFT PRIORITY: The single most important thing for the next shift to do first

Rules:
- Bullets only, no paragraphs
- Include source IDs where relevant (e.g., "See INC-2024-001 for prior pattern")
- Flag if safety escalation was triggered
- Max 1 page equivalent
- Label this clearly as a DRAFT at the top`;

    case "maintenance_request":
      return `${context}

Generate a maintenance request in CMMS-ready format. Output labeled fields, not prose paragraphs. Each field on its own line.

Required fields:
ASSET ID: (from context, or "TBD — verify on-site")
ASSET NAME:
PRIORITY: (Emergency / High / Medium / Low — based on analysis)
REPORTED BY:
DATE/TIME REPORTED:
LINE AFFECTED:
PROBLEM DESCRIPTION: (what the operator observed — symptoms, not root cause)
OBSERVED SYMPTOMS: (bulleted list — measurements, sounds, visual observations)
PRODUCTION IMPACT: (throughput loss %, units affected, line status)
SAFETY CONCERNS: (any from analysis, or "None identified")
SUGGESTED CHECKS: (bulleted list — what maintenance should inspect first, grounded in the hypotheses)
RELATED INCIDENTS: (cite prior incident IDs if recurrence pattern exists)
REFERENCED STANDARDS: (cite standard IDs relevant to the work)
PARTS THAT MAY BE NEEDED: (based on hypotheses — mark as "verify before ordering")
REQUESTED COMPLETION: (this shift / today / this week)

Label this clearly as a DRAFT at the top. Do not invent asset IDs or measurements not in the context.`;

    case "capa_outline":
      return `${context}

Generate a CAPA (Corrective and Preventive Action) outline. This is a structured skeleton — the quality team will flesh it out. Use the standard 8-section CAPA structure.

Required sections:
1. PROBLEM STATEMENT
   - What happened, when, where, scope of impact
   - Quantify: throughput loss, units affected, downtime

2. IMMEDIATE CONTAINMENT
   - Actions taken to stop the bleeding (from Stabilize bucket)
   - Disposition of suspect product/material if applicable

3. ROOT CAUSE ANALYSIS APPROACH
   - Which hypothesis/hypotheses to investigate (cite confidence levels)
   - Proposed RCA method (5-Why, fishbone, etc.)
   - Evidence to collect (cite source IDs)

4. CORRECTIVE ACTIONS
   - Specific actions to address confirmed root cause(s)
   - Owner roles and target dates

5. PREVENTIVE ACTIONS
   - Systemic changes to prevent recurrence (from Prevent bucket)
   - PM schedule changes, procedure updates, training

6. VERIFICATION PLAN
   - How you'll confirm the fix worked
   - Metrics to monitor and for how long

7. RECURRENCE CHECK
   - Is this a known pattern? (cite prior incidents if applicable)
   - Has this occurred at other lines/plants?

8. DOCUMENT CONTROL
   - Which standards, procedures, or travelers need updating

Label this clearly as a DRAFT CAPA OUTLINE at the top. Owners are roles, not names — the team will assign names.`;

    case "supplier_questions":
      return `${context}

Generate a numbered list of specific, evidence-linked questions for the supplier. These will be sent as part of a Supplier Corrective Action Request (SCAR) or supplier inquiry. Each question must be grounded in something observed or documented.

Format each question as:
Q[N]. [Question text]
   Basis: [What evidence or observation this is based on — cite source_id]
   Expected response: [What we need from the supplier — data, cert, action plan, etc.]

Include questions about:
- Specific lot numbers, delivery dates, or material certifications implicated
- Process changes (machine changes, tooling changes, operator changes) since last conforming lot
- SPC data or process capability records for the relevant dimension/characteristic
- Inspection records at the supplier's facility for this lot
- Corrective actions taken since last SCAR (if applicable — cite prior incidents)
- Timeline for corrective action implementation and verification

Rules:
- Each question must have a specific, documentable expected response
- Do not ask vague questions ("please investigate") — be precise
- If the analysis suggests supplier is not the primary cause, still include questions but note that supplier is secondary in the intro
- Label this clearly as a DRAFT SUPPLIER INQUIRY at the top
- Include a brief 2-sentence intro explaining why the inquiry is being sent`;
  }
}
