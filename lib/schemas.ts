import { z } from "zod";

export const IncidentInputSchema = z.object({
  problem_statement: z.string().min(10, "Problem statement must be at least 10 characters"),
  plant_id: z.string(),
  line_id: z.string(),
  timeframe: z.object({
    start: z.iso.datetime({ error: "start must be an ISO datetime string" }),
    end: z.iso.datetime({ error: "end must be an ISO datetime string" }),
  }),
  logs: z.string().optional(),
  notes: z.string().optional(),
});

export type IncidentInput = z.infer<typeof IncidentInputSchema>;

const EvidenceItemSchema = z.object({
  source_id: z.string().catch(""),
  source_kind: z.enum(["standard", "incident", "maintenance", "quality", "user_log"]).catch("user_log"),
  note: z.string().catch(""),
});

const HypothesisSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
  // Truncated reasoning or missing field — accept empty string rather than failing the parse
  reasoning: z.string().catch(""),
  evidence: z.array(EvidenceItemSchema).catch([]),
});

const ActionItemSchema = z.object({
  title: z.string().catch(""),
  detail: z.string().catch(""),
  owner_role: z.string().catch(""),
  eta: z.enum(["now", "this shift", "this week"]).catch("this shift"),
  linked_evidence: z.array(z.string()).catch([]),
});

const ActionsSchema = z.object({
  stabilize: z.array(ActionItemSchema).catch([]),
  investigate: z.array(ActionItemSchema).catch([]),
  prevent_recurrence: z.array(ActionItemSchema).catch([]),
});

const NextStepsSchema = z.object({
  suggested_drafts: z
    .array(z.enum(["shift_handoff", "maintenance_request", "capa_outline", "supplier_questions"]))
    .catch([]),
});

const SafetyEscalationSchema = z.object({
  triggered: z.boolean().catch(false),
  reason: z.string().optional(),
});

export const AnalysisSchema = z.object({
  safety_escalation: SafetyEscalationSchema.catch({ triggered: false }),
  // min(1): require at least one usable hypothesis; truncated responses may have fewer than 2
  hypotheses: z.array(HypothesisSchema).min(1).max(5),
  // Truncation often cuts the response before actions are written — default to empty buckets
  actions: ActionsSchema.catch({ stabilize: [], investigate: [], prevent_recurrence: [] }),
  next_steps: NextStepsSchema.catch({ suggested_drafts: [] }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const DRAFT_KINDS = ["shift_handoff", "maintenance_request", "capa_outline", "supplier_questions"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_LABELS: Record<DraftKind, string> = {
  shift_handoff: "Shift Handoff Note",
  maintenance_request: "Maintenance Request",
  capa_outline: "CAPA Outline",
  supplier_questions: "Supplier Questions",
};

export const DraftRequestSchema = z.object({
  kind: z.enum(DRAFT_KINDS),
  incident: IncidentInputSchema,
  analysis: AnalysisSchema,
});

export type DraftRequest = z.infer<typeof DraftRequestSchema>;
