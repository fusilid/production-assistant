import standardsData from "@/data/standards.json";
import type { IncidentInput } from "@/lib/schemas";

interface Standard {
  id: string;
  title: string;
  plant_ids?: string[];
  line_ids?: string[];
  equipment_types?: string[];
  summary: string;
  thresholds?: Record<string, number | string>;
  reference: string;
  last_revised: string;
}

export interface RetrievedStandard {
  source_id: string;
  source_kind: "standard";
  title: string;
  summary: string;
  thresholds?: Record<string, number | string>;
  reference: string;
}

export function getRelevantStandards(incident: IncidentInput): RetrievedStandard[] {
  const standards = standardsData as Standard[];
  return standards
    .filter((std) => {
      const plantMatch =
        !std.plant_ids || std.plant_ids.includes(incident.plant_id);
      const lineMatch =
        !std.line_ids || std.line_ids.includes(incident.line_id);
      return plantMatch && lineMatch;
    })
    .map((std) => ({
      source_id: std.id,
      source_kind: "standard" as const,
      title: std.title,
      summary: std.summary,
      thresholds: std.thresholds,
      reference: std.reference,
    }));
}
