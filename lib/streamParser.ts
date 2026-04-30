import type { Hypothesis, ActionItem } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PartialHypothesis {
  summary?: string;
  confidence?: "high" | "medium" | "low";
  reasoning?: string; // may be mid-stream (no closing quote yet)
}

export interface PartialActionItem {
  bucket: "stabilize" | "investigate" | "prevent_recurrence";
  title?: string;
  detail?: string; // may be mid-stream
}

export interface StreamingAnalysis {
  safety_escalation: { triggered: boolean; reason?: string } | null;
  hypotheses: Hypothesis[];           // confirmed-complete hypothesis objects
  currentHypothesis: PartialHypothesis | null; // the one being written right now
  actions: {
    stabilize: ActionItem[];
    investigate: ActionItem[];
    prevent_recurrence: ActionItem[];
  };
  currentAction: PartialActionItem | null; // the action item being written right now
}

// ---------------------------------------------------------------------------
// Main parse entry point
// ---------------------------------------------------------------------------

export function parseStreamingAnalysis(text: string): StreamingAnalysis {
  const hypArr = extractArray<Hypothesis>(text, "hypotheses");
  const stabArr = extractArray<ActionItem>(text, "stabilize");
  const invArr = extractArray<ActionItem>(text, "investigate");
  const prevArr = extractArray<ActionItem>(text, "prevent_recurrence");

  // First streaming action bucket found wins
  let currentAction: PartialActionItem | null = null;
  if (stabArr.streamingText) {
    currentAction = { bucket: "stabilize", ...extractPartialStrings(stabArr.streamingText, ["title", "detail"]) };
  } else if (invArr.streamingText) {
    currentAction = { bucket: "investigate", ...extractPartialStrings(invArr.streamingText, ["title", "detail"]) };
  } else if (prevArr.streamingText) {
    currentAction = { bucket: "prevent_recurrence", ...extractPartialStrings(prevArr.streamingText, ["title", "detail"]) };
  }

  return {
    safety_escalation: extractObject<{ triggered: boolean; reason?: string }>(text, "safety_escalation"),
    hypotheses: hypArr.complete,
    currentHypothesis: hypArr.streamingText
      ? (extractPartialStrings(hypArr.streamingText, ["summary", "confidence", "reasoning"]) as PartialHypothesis)
      : null,
    actions: {
      stabilize: stabArr.complete,
      investigate: invArr.complete,
      prevent_recurrence: prevArr.complete,
    },
    currentAction,
  };
}

export function hasAnyStreamingData(s: StreamingAnalysis): boolean {
  return (
    s.safety_escalation !== null ||
    s.hypotheses.length > 0 ||
    s.currentHypothesis !== null ||
    s.actions.stabilize.length > 0 ||
    s.actions.investigate.length > 0 ||
    s.actions.prevent_recurrence.length > 0 ||
    s.currentAction !== null
  );
}

// ---------------------------------------------------------------------------
// JSON repair — fixes truncated responses (missing closing brackets)
// ---------------------------------------------------------------------------

export function repairJson(raw: string): unknown | null {
  const text = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Fast path — already valid
  try { return JSON.parse(text); } catch { /* fall through */ }

  // Strip trailing commas before any closing bracket — models occasionally emit these
  // e.g. [{"a":1},] or {"a":1,} — do this before the bracket walk so stack ends correct
  const cleaned = text.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // Walk cleaned text tracking open brackets and string state to find what's missing
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of cleaned) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }

  // Nothing structurally open — JSON is balanced but still invalid (e.g. bad escape).
  // Return null; we can't repair arbitrary syntax errors.
  if (stack.length === 0 && !inString) return null;

  // Close any open string, strip trailing comma/whitespace, close open brackets
  let repaired = inString ? cleaned + '"' : cleaned;
  repaired = repaired.trimEnd().replace(/,\s*$/, "").trimEnd();
  repaired += stack.reverse().join("");

  try { return JSON.parse(repaired); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ArrayResult<T> {
  complete: T[];
  streamingText: string | null; // raw text of the in-progress object, if any
}

// Extract confirmed-complete objects from an array AND return the text of the
// currently-streaming object (the last one without a confirmed closer).
function extractArray<T>(text: string, key: string): ArrayResult<T> {
  const keySearch = `"${key}":`;
  const keyIdx = text.indexOf(keySearch);
  if (keyIdx === -1) return { complete: [], streamingText: null };

  const bracketIdx = text.indexOf("[", keyIdx + keySearch.length);
  if (bracketIdx === -1) return { complete: [], streamingText: null };

  const complete: T[] = [];
  let pos = bracketIdx + 1;
  let streamingText: string | null = null;

  while (pos < text.length) {
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
    if (pos >= text.length || text[pos] === "]") break;
    if (text[pos] !== "{") { pos++; continue; }

    const objectStart = pos;
    const closeIdx = findMatchingClose(text, pos);

    if (closeIdx === -1) {
      // Opening { with no matching } yet — object is still being written
      streamingText = text.slice(objectStart);
      break;
    }

    const after = text.slice(closeIdx + 1).trimStart();
    if (after.length > 0 && (after[0] === "," || after[0] === "]")) {
      // Confirmed complete
      try { complete.push(JSON.parse(text.slice(objectStart, closeIdx + 1)) as T); } catch { /* skip */ }
      pos = closeIdx + 1;
    } else {
      // Has a closing } but nothing confirmed after it yet — still possibly streaming
      streamingText = text.slice(objectStart);
      break;
    }
  }

  return { complete, streamingText };
}

// Extract a single JSON object value for a given key.
function extractObject<T>(text: string, key: string): T | null {
  const keySearch = `"${key}":`;
  const keyIdx = text.indexOf(keySearch);
  if (keyIdx === -1) return null;

  const braceIdx = text.indexOf("{", keyIdx + keySearch.length);
  if (braceIdx === -1) return null;

  const closeIdx = findMatchingClose(text, braceIdx);
  if (closeIdx === -1) return null;

  try { return JSON.parse(text.slice(braceIdx, closeIdx + 1)) as T; } catch { return null; }
}

// Extract string values for the given keys from a partial (possibly truncated) object.
function extractPartialStrings(text: string, keys: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = extractStringValue(text, key);
  }
  return result;
}

// Extract a string value for a key from partial JSON text.
// The string may be incomplete (no closing quote) — returns whatever has arrived.
function extractStringValue(text: string, key: string): string | undefined {
  const keySearch = `"${key}":`;
  const keyIdx = text.indexOf(keySearch);
  if (keyIdx === -1) return undefined;

  const afterKey = text.slice(keyIdx + keySearch.length).trimStart();
  if (!afterKey.startsWith('"')) return undefined;

  let value = "";
  let i = 1; // skip opening "
  while (i < afterKey.length) {
    const ch = afterKey[i];
    if (ch === "\\" && i + 1 < afterKey.length) {
      const next = afterKey[i + 1];
      if (next === "n") value += "\n";
      else if (next === "t") value += "\t";
      else if (next === '"') value += '"';
      else if (next === "\\") value += "\\";
      else value += next;
      i += 2;
    } else if (ch === "\\" ) {
      break; // trailing backslash with no next char — stop
    } else if (ch === '"') {
      break; // closing quote
    } else {
      value += ch;
      i++;
    }
  }
  return value || undefined;
}

// Find the index of the } that closes the { at `start`, handling nested
// structures and quoted strings.
function findMatchingClose(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return i; }
    }
  }
  return -1;
}
