import incidentsData from "@/data/incidents.json";
import type { IncidentInput } from "@/lib/schemas";

interface Incident {
  id: string;
  plant_id: string;
  line_id: string;
  equipment: string;
  date: string;
  title: string;
  description: string;
  root_cause: string;
  resolution: string;
  duration_minutes: number | null;
  related_standard_ids: string[];
  recurrence?: boolean;
  prior_incident_id?: string;
  safety_event?: boolean;
  near_miss?: boolean;
  injury?: boolean;
  tags: string[];
}

export interface RetrievedIncident {
  source_id: string;
  source_kind: "incident";
  date: string;
  title: string;
  description: string;
  root_cause: string;
  resolution: string;
  duration_minutes: number | null;
  recurrence: boolean;
  tags: string[];
}

const MAX_INCIDENTS = 8;

export function getRelevantIncidents(incident: IncidentInput): RetrievedIncident[] {
  const incidents = incidentsData as Incident[];

  // Primary: same plant and line
  const sameLine = incidents.filter(
    (inc) => inc.plant_id === incident.plant_id && inc.line_id === incident.line_id
  );

  // Secondary: same plant, different line
  const samePlant = incidents.filter(
    (inc) => inc.plant_id === incident.plant_id && inc.line_id !== incident.line_id
  );

  // Sort by date descending (most recent first)
  const sortByDate = (a: Incident, b: Incident) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  const combined = [
    ...sameLine.sort(sortByDate),
    ...samePlant.sort(sortByDate),
  ].slice(0, MAX_INCIDENTS);

  return combined.map((inc) => ({
    source_id: inc.id,
    source_kind: "incident" as const,
    date: inc.date,
    title: inc.title,
    description: inc.description,
    root_cause: inc.root_cause,
    resolution: inc.resolution,
    duration_minutes: inc.duration_minutes,
    recurrence: inc.recurrence ?? false,
    tags: inc.tags,
  }));
}
