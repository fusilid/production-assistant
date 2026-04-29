"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IncidentInput } from "@/lib/schemas";

const PLANTS: Record<string, { name: string; lines: { id: string; name: string }[] }> = {
  "spokane-assembly": {
    name: "Spokane Assembly",
    lines: [
      { id: "SAP-LINE-A", name: "Line A — Stamping & Assembly" },
      { id: "SAP-LINE-B", name: "Line B — Assembly & Weld" },
      { id: "SAP-LINE-C", name: "Line C — Valve Sub-Assembly" },
    ],
  },
  "tacoma-fabrication": {
    name: "Tacoma Fabrication",
    lines: [
      { id: "TFB-LINE-1", name: "Line 1 — Heavy Press" },
      { id: "TFB-LINE-2", name: "Line 2 — Precision Stamping" },
      { id: "TFB-LINE-3", name: "Line 3 — Rod & Bar" },
      { id: "TFB-LINE-B", name: "Line B — Conveyor Assembly Feed" },
    ],
  },
  "bend-packaging": {
    name: "Bend Packaging",
    lines: [
      { id: "BPK-LINE-1", name: "Line 1 — Primary Packaging" },
      { id: "BPK-LINE-2", name: "Line 2 — Primary Packaging" },
      { id: "BPK-LINE-3", name: "Line 3 — Secondary Packaging" },
    ],
  },
};

const EXAMPLE_INCIDENT: Partial<IncidentInput> = {
  problem_statement:
    "Output dropped 18% on Tacoma Line B since 06:00, two operators report unusual vibration on conveyor C-12. Noise started around 05:45, getting louder. No jams observed.",
  plant_id: "tacoma-fabrication",
  line_id: "TFB-LINE-B",
};

interface Props {
  onSubmit: (incident: IncidentInput) => void;
  isLoading: boolean;
}

function getDefaultTimeframe() {
  const end = new Date();
  const start = new Date(end.getTime() - 8 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 16),
    end: end.toISOString().slice(0, 16),
  };
}

export function IncidentForm({ onSubmit, isLoading }: Props) {
  const defaults = getDefaultTimeframe();
  const [plantId, setPlantId] = useState("");
  const [lineId, setLineId] = useState("");
  const [problem, setProblem] = useState("");
  const [logs, setLogs] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function loadExample() {
    setProblem(EXAMPLE_INCIDENT.problem_statement ?? "");
    setPlantId(EXAMPLE_INCIDENT.plant_id ?? "");
    setLineId(EXAMPLE_INCIDENT.line_id ?? "");
    setErrors({});
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!problem.trim() || problem.trim().length < 10)
      errs.problem = "Problem statement required (min 10 characters)";
    if (!plantId) errs.plant = "Select a plant";
    if (!lineId) errs.line = "Select a line";
    if (!startTime) errs.start = "Start time required";
    if (!endTime) errs.end = "End time required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      problem_statement: problem.trim(),
      plant_id: plantId,
      line_id: lineId,
      timeframe: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
      },
      logs: logs.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const lines = plantId ? PLANTS[plantId]?.lines ?? [] : [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Incident Report
        </h2>
        <button
          type="button"
          onClick={loadExample}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Load example
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Problem Statement <span className="text-red-400">*</span>
        </label>
        <Textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Describe what's happening. Include symptoms, when it started, what operators observed."
          className="bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600 text-sm min-h-[100px] resize-none"
        />
        {errors.problem && <p className="text-red-400 text-xs mt-1">{errors.problem}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Plant <span className="text-red-400">*</span>
          </label>
          <Select
            value={plantId}
            onValueChange={(v) => {
              setPlantId(v ?? "");
              setLineId("");
            }}
          >
            <SelectTrigger className="bg-gray-900 border-gray-700 text-gray-100 text-sm">
              <SelectValue placeholder="Select plant" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {Object.entries(PLANTS).map(([id, p]) => (
                <SelectItem key={id} value={id} className="text-gray-100 text-sm">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.plant && <p className="text-red-400 text-xs mt-1">{errors.plant}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Line <span className="text-red-400">*</span>
          </label>
          <Select value={lineId} onValueChange={(v) => setLineId(v ?? "")} disabled={!plantId}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-gray-100 text-sm disabled:opacity-50">
              <SelectValue placeholder={plantId ? "Select line" : "Select plant first"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {lines.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-gray-100 text-sm">
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.line && <p className="text-red-400 text-xs mt-1">{errors.line}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Start Time <span className="text-red-400">*</span>
          </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-2"
          />
          {errors.start && <p className="text-red-400 text-xs mt-1">{errors.start}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            End Time <span className="text-red-400">*</span>
          </label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-md px-3 py-2"
          />
          {errors.end && <p className="text-red-400 text-xs mt-1">{errors.end}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Operator Logs / Additional Data
          <span className="text-gray-600 ml-1">(optional)</span>
        </label>
        <Textarea
          value={logs}
          onChange={(e) => setLogs(e.target.value)}
          placeholder="Paste HMI readouts, SCADA logs, operator notes, error codes..."
          className="bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600 text-sm min-h-[80px] resize-none font-mono text-xs"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Additional Notes <span className="text-gray-600">(optional)</span>
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Recent changeovers, material lot changes, staffing notes..."
          className="bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600 text-sm min-h-[60px] resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 disabled:opacity-60"
      >
        {isLoading ? "Analyzing..." : "Analyze Incident"}
      </Button>
    </form>
  );
}
