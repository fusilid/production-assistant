import maintenanceData from "@/data/maintenance.json";
import type { IncidentInput } from "@/lib/schemas";

interface Asset {
  asset_id: string;
  name: string;
  plant_id: string;
  line_id: string;
  type: string;
  manufacturer: string;
  model: string;
  install_date: string;
  criticality: string;
  mtbf_days?: number;
  pm_schedule: Array<{
    task: string;
    interval_days: number;
    standard_ref?: string;
  }>;
}

interface WorkOrder {
  wo_id: string;
  asset_id: string;
  plant_id: string;
  line_id: string;
  type: string;
  description: string;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  technician: string | null;
  notes: string;
  parts_used: Array<{
    part_no: string;
    qty: number;
    supplier: string;
    lot: string;
  }>;
}

interface MaintenanceData {
  assets: Asset[];
  work_orders: WorkOrder[];
}

export interface RetrievedMaintenanceRecord {
  source_id: string;
  source_kind: "maintenance";
  asset_id: string;
  asset_name: string;
  type: "asset" | "work_order";
  description: string;
  status?: string;
  scheduled_date?: string;
  completed_date?: string | null;
  notes: string;
  parts_used?: WorkOrder["parts_used"];
}

const MAX_WORK_ORDERS = 6;

export function getRelevantMaintenance(incident: IncidentInput): RetrievedMaintenanceRecord[] {
  const data = maintenanceData as MaintenanceData;
  const results: RetrievedMaintenanceRecord[] = [];

  const lineAssets = data.assets.filter(
    (a) => a.plant_id === incident.plant_id && a.line_id === incident.line_id
  );

  for (const asset of lineAssets) {
    results.push({
      source_id: `ASSET-${asset.asset_id}`,
      source_kind: "maintenance" as const,
      asset_id: asset.asset_id,
      asset_name: asset.name,
      type: "asset",
      description: `${asset.type} | ${asset.manufacturer} ${asset.model} | Installed ${asset.install_date} | Criticality: ${asset.criticality}${asset.mtbf_days ? ` | MTBF: ${asset.mtbf_days} days` : ""}`,
      notes: `PM Schedule: ${asset.pm_schedule.map((p) => `${p.task} every ${p.interval_days} days`).join("; ")}`,
    });
  }

  const assetIds = lineAssets.map((a) => a.asset_id);
  const relevantWOs = data.work_orders
    .filter(
      (wo) =>
        wo.plant_id === incident.plant_id &&
        (wo.line_id === incident.line_id || assetIds.includes(wo.asset_id))
    )
    .sort(
      (a, b) =>
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
    )
    .slice(0, MAX_WORK_ORDERS);

  for (const wo of relevantWOs) {
    const asset = data.assets.find((a) => a.asset_id === wo.asset_id);
    results.push({
      source_id: wo.wo_id,
      source_kind: "maintenance" as const,
      asset_id: wo.asset_id,
      asset_name: asset?.name ?? wo.asset_id,
      type: "work_order",
      description: `[${wo.type}] ${wo.description} — Status: ${wo.status}`,
      status: wo.status,
      scheduled_date: wo.scheduled_date,
      completed_date: wo.completed_date,
      notes: wo.notes,
      parts_used: wo.parts_used,
    });
  }

  return results;
}
