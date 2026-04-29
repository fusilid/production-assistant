import qualityData from "@/data/quality.json";
import type { IncidentInput } from "@/lib/schemas";

interface DefectCategory {
  id: string;
  plant_ids: string[];
  line_ids?: string[];
  category: string;
  description: string;
  measurement: string;
  thresholds: Record<string, number | string>;
  cpk_target?: number;
  cpk_hold?: number;
  standard_ref: string;
  supplier_id?: string;
  typical_root_causes?: string[];
  actions?: Record<string, string>;
  cpk_applicable?: boolean;
}

interface QualityData {
  defect_categories: DefectCategory[];
}

export interface RetrievedQualityThreshold {
  source_id: string;
  source_kind: "quality";
  category: string;
  description: string;
  measurement: string;
  thresholds: Record<string, number | string>;
  cpk_target?: number;
  cpk_hold?: number;
  standard_ref: string;
  typical_root_causes?: string[];
}

export function getRelevantQualityThresholds(
  incident: IncidentInput
): RetrievedQualityThreshold[] {
  const data = qualityData as unknown as QualityData;
  return data.defect_categories
    .filter((cat) => {
      const plantMatch = cat.plant_ids.includes(incident.plant_id);
      const lineMatch = !cat.line_ids || cat.line_ids.includes(incident.line_id);
      return plantMatch && lineMatch;
    })
    .map((cat) => ({
      source_id: cat.id,
      source_kind: "quality" as const,
      category: cat.category,
      description: cat.description,
      measurement: cat.measurement,
      thresholds: cat.thresholds,
      cpk_target: cat.cpk_target,
      cpk_hold: cat.cpk_hold,
      standard_ref: cat.standard_ref,
      typical_root_causes: cat.typical_root_causes,
    }));
}
