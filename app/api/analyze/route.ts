import { NextRequest, NextResponse } from "next/server";
import { IncidentInputSchema } from "@/lib/schemas";
import { detectSafetyEscalation, buildSafetyText } from "@/lib/safety";
import { getRelevantStandards } from "@/lib/context/standards";
import { getRelevantIncidents } from "@/lib/context/incidents";
import { getRelevantMaintenance } from "@/lib/context/maintenance";
import { getRelevantQualityThresholds } from "@/lib/context/quality";
import { buildAnalysisPrompt } from "@/lib/prompts/analyze";
import { anthropic, MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IncidentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid incident input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const incident = parsed.data;

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: [
            {
              type: "text",
              text: system,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: user }],
        });

        msgStream.on("text", (text) => controller.enqueue(encoder.encode(text)));
        await msgStream.finalMessage();
      } catch (err) {
        console.error("LLM stream failed:", err);
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Safety-Triggered": safetyResult.triggered ? "true" : "false",
      "X-Safety-Reason": safetyResult.reason ?? "",
    },
  });
}
