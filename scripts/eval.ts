/**
 * Eval script — runs canned incidents through the analyze pipeline and
 * writes structured output to eval-snapshots/. Used for prompt regression testing.
 *
 * Run: npm run eval
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import Anthropic from "@anthropic-ai/sdk";
import { AnalysisSchema, IncidentInputSchema, type IncidentInput } from "../lib/schemas";
import { detectSafetyEscalation, buildSafetyText } from "../lib/safety";
import { stripMarkdownFences } from "../lib/utils";
import { getRelevantStandards } from "../lib/context/standards";
import { getRelevantIncidents } from "../lib/context/incidents";
import { getRelevantMaintenance } from "../lib/context/maintenance";
import { getRelevantQualityThresholds } from "../lib/context/quality";
import { buildAnalysisPrompt } from "../lib/prompts/analyze";

const MODEL = "claude-sonnet-4-6";

const CANNED_INCIDENTS: Array<{ label: string; incident: IncidentInput }> = [
  {
    label: "throughput-drop-tacoma-line-b",
    incident: {
      problem_statement:
        "Output dropped 18% on Tacoma Line B since 06:00, two operators report unusual vibration on conveyor C-12. Noise started around 05:45, getting louder. No jams observed.",
      plant_id: "tacoma-fabrication",
      line_id: "TFB-LINE-B",
      timeframe: {
        start: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "safety-loto-violation",
    incident: {
      problem_statement:
        "Maintenance tech cleared a jam on conveyor C-08 without applying lockout tagout. Near miss — tech's hand got close to the drive sprocket. Line is stopped. EHS notified.",
      plant_id: "spokane-assembly",
      line_id: "SAP-LINE-B",
      timeframe: {
        start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      notes: "LOTO procedure was posted at the station but was not followed.",
    },
  },
  {
    label: "seal-bar-low-temp-bend-line1",
    incident: {
      problem_statement:
        "Seal bar SB-1 on BPK Line 1 reading 138°C against a 150°C setpoint. Three test packs failed peel strength at 9 N/15mm (limit 12 N). About 150 units on hold.",
      plant_id: "bend-packaging",
      line_id: "BPK-LINE-1",
      timeframe: {
        start: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      logs: "07:45 SB-1 temp alarm: setpoint 150C, actual 138C\n07:48 Production paused\n07:55 Peel test: samples 9.1, 8.8, 9.4 N/15mm — all fail",
    },
  },
  {
    label: "supplier-cpk-failure-spokane-line-c",
    incident: {
      problem_statement:
        "Incoming lot from Jenner Valve failed PPAP re-verification. Cpk for bore diameter measured at 1.19. Lot quarantined. This is the fourth SCAR in 15 months for this supplier.",
      plant_id: "spokane-assembly",
      line_id: "SAP-LINE-C",
      timeframe: {
        start: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "press-die-burr-spokane-line-a",
    incident: {
      problem_statement:
        "Quality hold at 14:30: 8 of 25 sampled parts from Press P-3 show burr height 0.15–0.22mm against a 0.1mm limit. About 400 parts in suspect lot. Setup was done 2 hours ago.",
      plant_id: "spokane-assembly",
      line_id: "SAP-LINE-A",
      timeframe: {
        start: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "sanitation-atp-failure-bend-line2",
    incident: {
      problem_statement:
        "QA auditor found sanitation log for BPK Line 2 unsigned from last shift. Line has been idle 68 hours over the weekend. ATP swab result: 380 RLU (limit 100 RLU). Pre-production sanitation needed.",
      plant_id: "bend-packaging",
      line_id: "BPK-LINE-2",
      timeframe: {
        start: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "spc-outofcontrol-tacoma-line2",
    incident: {
      problem_statement:
        "SPC control chart for part flatness on Press P-4 showing 9 consecutive points above mean — Nelson Rule 4 violation. Process paused for assignable cause investigation. Ambient temp in building is high today (36°C).",
      plant_id: "tacoma-fabrication",
      line_id: "TFB-LINE-2",
      timeframe: {
        start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "throughput-drop-spokane-line-b",
    incident: {
      problem_statement:
        "Throughput on SAP Line B dropped 20% at shift start (06:00). No obvious noise. Operators report conveyor C-08 feeling sluggish. Maintenance called at 06:15.",
      plant_id: "spokane-assembly",
      line_id: "SAP-LINE-B",
      timeframe: {
        start: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "motor-overload-bend-line3",
    incident: {
      problem_statement:
        "CB-5 drive motor on BPK Line 3 tripped overload relay. Motor winding temp was at 142°C (limit 130°C). 35-minute unplanned downtime. Accumulation sensor may have failed.",
      plant_id: "bend-packaging",
      line_id: "BPK-LINE-3",
      timeframe: {
        start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
  {
    label: "safety-fire-smoke-near-press",
    incident: {
      problem_statement:
        "Smoke observed coming from the motor housing on Press P-1. Possible electrical fire. Operators evacuated the area. EHS called. Line stopped immediately.",
      plant_id: "tacoma-fabrication",
      line_id: "TFB-LINE-1",
      timeframe: {
        start: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    },
  },
];

async function runEval() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: ANTHROPIC_API_KEY not set. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });
  const snapshotDir = path.join(process.cwd(), "eval-snapshots");
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(snapshotDir, `run-${timestamp}`);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`\n🏭 Production Issue Resolution — Eval Run`);
  console.log(`   Snapshots: ${runDir}\n`);

  const results: Array<{ label: string; passed: boolean; error?: string }> = [];

  for (const { label, incident } of CANNED_INCIDENTS) {
    process.stdout.write(`  Running: ${label}... `);

    const validated = IncidentInputSchema.safeParse(incident);
    if (!validated.success) {
      console.log(`FAIL (input validation: ${JSON.stringify(validated.error.flatten())})`);
      results.push({ label, passed: false, error: "Input validation failed" });
      continue;
    }

    const safetyResult = detectSafetyEscalation(buildSafetyText(incident));

    const standards = getRelevantStandards(incident);
    const incidents = getRelevantIncidents(incident);
    const maintenance = getRelevantMaintenance(incident);
    const quality = getRelevantQualityThresholds(incident);

    const { system, user } = buildAnalysisPrompt(incident, {
      standards,
      incidents,
      maintenance,
      quality,
      safetyResult,
    });

    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No text block in response");

      const rawContent = stripMarkdownFences(textBlock.text);

      const parsed = JSON.parse(rawContent);
      const analysisResult = AnalysisSchema.safeParse(parsed);

      if (!analysisResult.success) {
        const errors = JSON.stringify(analysisResult.error.flatten(), null, 2);
        console.log(`FAIL (schema validation)`);
        fs.writeFileSync(
          path.join(runDir, `${label}.error.json`),
          JSON.stringify({ raw: parsed, errors: analysisResult.error.flatten() }, null, 2)
        );
        results.push({ label, passed: false, error: "Schema validation failed" });
        continue;
      }

      const analysis = analysisResult.data;
      if (safetyResult.triggered) {
        analysis.safety_escalation.triggered = true;
        analysis.safety_escalation.reason = safetyResult.reason;
      }

      const snapshot = {
        label,
        timestamp: new Date().toISOString(),
        incident,
        safety_result: safetyResult,
        context_counts: {
          standards: standards.length,
          incidents: incidents.length,
          maintenance: maintenance.length,
          quality: quality.length,
        },
        analysis,
      };

      fs.writeFileSync(
        path.join(runDir, `${label}.json`),
        JSON.stringify(snapshot, null, 2)
      );

      const hypothesisCount = analysis.hypotheses.length;
      const safetyTriggered = analysis.safety_escalation.triggered;
      const hasCitations = analysis.hypotheses.every((h) => h.evidence.length > 0);
      const hasAllBuckets =
        analysis.actions.stabilize.length > 0 &&
        analysis.actions.investigate.length > 0 &&
        analysis.actions.prevent_recurrence.length > 0;

      const checks = [
        hypothesisCount >= 2 && hypothesisCount <= 4,
        hasCitations,
        hasAllBuckets,
        !label.includes("safety") || safetyTriggered,
      ];

      const passed = checks.every(Boolean);
      console.log(
        passed
          ? `PASS (${hypothesisCount} hypotheses, safety=${safetyTriggered}, citations=${hasCitations}, buckets=${hasAllBuckets})`
          : `FAIL checks: hyp=${hypothesisCount}, citations=${hasCitations}, buckets=${hasAllBuckets}, safety=${safetyTriggered}`
      );
      results.push({ label, passed });
    } catch (err) {
      console.log(`ERROR: ${err}`);
      results.push({ label, passed: false, error: String(err) });
    }
  }

  console.log(`\n  Results: ${results.filter((r) => r.passed).length}/${results.length} passed`);
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log("  Failures:");
    for (const f of failures) console.log(`    - ${f.label}: ${f.error ?? "check failure"}`);
  }
  console.log(`\n  Snapshots saved to: ${runDir}\n`);
}

runEval().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
