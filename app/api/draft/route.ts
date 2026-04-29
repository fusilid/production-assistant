import { NextRequest, NextResponse } from "next/server";
import { DraftRequestSchema } from "@/lib/schemas";
import { buildDraftPrompt } from "@/lib/prompts/drafts";
import { anthropic, MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = DraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid draft request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { kind, incident, analysis } = parsed.data;
  const prompt = buildDraftPrompt(kind, incident, analysis);

  let draftText: string;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from model" }, { status: 502 });
    }
    draftText = textBlock.text;
  } catch (err) {
    console.error("LLM draft call failed:", err);
    return NextResponse.json({ error: "Model call failed", detail: String(err) }, { status: 502 });
  }

  return NextResponse.json({ draft: draftText });
}
