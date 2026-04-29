import { z } from "zod";

export const IncidentInputSchema = z.object({
  problem_statement: z.string().min(10, "Problem statement must be at least 10 characters"),
  plant_id: z.string(),
  line_id: z.string(),
  timeframe: z.object({
    start: z.string().datetime({ message: "start must be an ISO datetime string" }),
    end: z.string().datetime({ message: "end must be an ISO datetime string" }),
  }),
  logs: z.string().optional(),
  notes: z.string().optional(),
});

export type IncidentInput = z.infer<typeof IncidentInputSchema>;

const EvidenceItemSchema = z.object({
  source_id: z.string(),
  source_kind: z.enum(["standard", "incident", "maintenance", "quality", "user_log"]),
  note: z.string(),
});

const HypothesisSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
  evidence: z.array(EvidenceItemSchema),
});

const ActionItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  owner_role: z.string(),
  eta: z.enum(["now", "this shift", "this week"]),
  linked_evidence: z.array(z.string()),
});

const ActionsSchema = z.object({
  stabilize: z.array(ActionItemSchema),
  investigate: z.array(ActionItemSchema),
  prevent_recurrence: z.array(ActionItemSchema),
});

const NextStepsSchema = z.object({
  suggested_drafts: z.array(
    z.enum(["shift_handoff", "maintenance_request", "capa_outline", "supplier_questions"])
  ),
});

const SafetyEscalationSchema = z.object({
  triggered: z.boolean(),
  reason: z.string().optional(),
});

export const AnalysisSchema = z.object({
  safety_escalation: SafetyEscalationSchema,
  hypotheses: z.array(HypothesisSchema).min(2).max(4),
  actions: ActionsSchema,
  next_steps: NextStepsSchema,
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const DraftRequestSchema = z.object({
  kind: z.enum(["shift_handoff", "maintenance_request", "capa_outline", "supplier_questions"]),
  incident: IncidentInputSchema,
  analysis: AnalysisSchema,
});

export type DraftRequest = z.infer<typeof DraftRequestSchema>;
