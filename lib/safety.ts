const SAFETY_LEXICON: Record<string, string[]> = {
  injury: ["injur", "hurt", "wound", "bleed", "lacerat", "fractur", "broken bone", "hospitali"],
  fire: ["fire", "flame", "ignit", "combust", "blaze", "arson"],
  smoke: ["smoke", "smolder", "haze", "fume"],
  gas: ["gas leak", "gas release", "ammonia", "chlorine", "hydrogen sulfide", "h2s", "co leak", "carbon monoxide", "asphyxiat", "oxygen deficien"],
  electrical: ["electr", "shock", "arc flash", "short circuit", "live wire", "energized conductor"],
  lockout: ["lockout", "loto", "lock out", "tag out", "tagout", "energy isolation"],
  evacuation: ["evacuat", "evacuee", "alarm", "emergency stop", "e-stop", "emergency shutdown"],
  fall: ["fall", "fell", "trip", "slip", "drop from height", "ladder incident"],
  nearMiss: ["near miss", "near-miss", "near hit", "close call", "almost hit", "narrowly avoided"],
  burn: ["burn", "scald", "thermal injur", "steam burn"],
  chemical: ["chemical release", "spill", "hazmat", "msds", "sds", "reactiv", "corrosiv", "toxic"],
  confined: ["confined space", "permit space", "low oxygen"],
  explosion: ["explos", "detona", "blast", "overpressure"],
  entrapment: ["entrap", "caught in", "pinch point", "crush", "amputat"],
};

export interface SafetyEscalationResult {
  triggered: boolean;
  matchedTerms: string[];
  reason?: string;
}

export function buildSafetyText(incident: {
  problem_statement: string;
  logs?: string;
  notes?: string;
}): string {
  return `${incident.problem_statement} ${incident.logs ?? ""} ${incident.notes ?? ""}`;
}

export function detectSafetyEscalation(text: string): SafetyEscalationResult {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const [category, terms] of Object.entries(SAFETY_LEXICON)) {
    for (const term of terms) {
      if (lower.includes(term)) {
        matched.push(`${category}:${term}`);
        break; // one match per category is enough
      }
    }
  }

  if (matched.length === 0) {
    return { triggered: false, matchedTerms: [] };
  }

  const categories = matched.map((m) => m.split(":")[0]);
  const reason = `Safety-relevant terms detected: ${categories.join(", ")}. Immediate escalation required.`;

  return { triggered: true, matchedTerms: matched, reason };
}
