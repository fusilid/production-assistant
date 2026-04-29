import { describe, it, expect } from "vitest";
import { detectSafetyEscalation } from "@/lib/safety";

describe("detectSafetyEscalation", () => {
  it("returns not triggered for a normal production issue", () => {
    const result = detectSafetyEscalation(
      "Output dropped 18% on Tacoma Line B. Operators report vibration on conveyor C-12."
    );
    expect(result.triggered).toBe(false);
    expect(result.matchedTerms).toHaveLength(0);
  });

  it("triggers on injury keyword", () => {
    const result = detectSafetyEscalation("Operator suffered a laceration on hand at station 4");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("injury"))).toBe(true);
  });

  it("triggers on fire keyword", () => {
    const result = detectSafetyEscalation("There is a fire near the press area");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("fire"))).toBe(true);
  });

  it("triggers on smoke keyword", () => {
    const result = detectSafetyEscalation("Smoke coming from the conveyor motor housing");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("smoke"))).toBe(true);
  });

  it("triggers on ammonia gas leak", () => {
    const result = detectSafetyEscalation("Possible ammonia leak in the refrigeration room");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("gas"))).toBe(true);
  });

  it("triggers on chlorine keyword", () => {
    const result = detectSafetyEscalation("Chlorine smell in packaging area — strong odor");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("gas"))).toBe(true);
  });

  it("triggers on electrical shock", () => {
    const result = detectSafetyEscalation("Operator received an electric shock at station 2");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("electrical"))).toBe(true);
  });

  it("triggers on lockout/tagout mention", () => {
    const result = detectSafetyEscalation("Maintenance cleared jam without applying lockout");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("lockout"))).toBe(true);
  });

  it("triggers on loto abbreviation", () => {
    const result = detectSafetyEscalation("Technician bypassed LOTO to clear a jam");
    expect(result.triggered).toBe(true);
  });

  it("triggers on evacuation keyword", () => {
    const result = detectSafetyEscalation("Emergency evacuation alarm sounded on Line 2");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("evacuation"))).toBe(true);
  });

  it("triggers on fall keyword", () => {
    const result = detectSafetyEscalation("Worker fell from the mezzanine platform");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("fall"))).toBe(true);
  });

  it("triggers on near miss", () => {
    const result = detectSafetyEscalation("Near miss on press P-1 — hand almost hit by ram");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("nearMiss"))).toBe(true);
  });

  it("triggers on burn keyword", () => {
    const result = detectSafetyEscalation("Operator burned hand on hot seal bar surface");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("burn"))).toBe(true);
  });

  it("triggers on chemical spill", () => {
    const result = detectSafetyEscalation("Chemical spill in the sanitation area — unknown substance");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("chemical"))).toBe(true);
  });

  it("triggers on explosion", () => {
    const result = detectSafetyEscalation("Heard a loud explosion near the compressor room");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("explosion"))).toBe(true);
  });

  it("triggers on entrapment/caught-in", () => {
    const result = detectSafetyEscalation("Worker's sleeve caught in the conveyor drive chain");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("entrapment"))).toBe(true);
  });

  it("triggers on confined space", () => {
    const result = detectSafetyEscalation("Tech entered confined space without permit");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("confined"))).toBe(true);
  });

  it("triggers on arc flash", () => {
    const result = detectSafetyEscalation("Arc flash occurred at MCC panel during inspection");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("electrical"))).toBe(true);
  });

  it("triggers on amputat keyword", () => {
    const result = detectSafetyEscalation("Partial amputation of finger at die press");
    expect(result.triggered).toBe(true);
    expect(result.matchedTerms.some((t) => t.startsWith("entrapment"))).toBe(true);
  });

  it("does not trigger on normal quality issue text", () => {
    const result = detectSafetyEscalation(
      "Seal bar temperature reading 138C, below 140C minimum. Peel strength failing. 150 units on hold."
    );
    expect(result.triggered).toBe(false);
  });

  it("does not trigger on throughput deviation text", () => {
    const result = detectSafetyEscalation(
      "Throughput down 20% on Line B. Conveyor vibration noted by operators. Maintenance called."
    );
    expect(result.triggered).toBe(false);
  });

  it("is case-insensitive", () => {
    const result = detectSafetyEscalation("OPERATOR INJURY AT STATION 4");
    expect(result.triggered).toBe(true);
  });

  it("scans logs text as well as problem statement", () => {
    const combined = "Normal throughput drop. Logs: FIRE ALARM ACTIVATED AT 06:32";
    const result = detectSafetyEscalation(combined);
    expect(result.triggered).toBe(true);
  });

  it("returns reason string when triggered", () => {
    const result = detectSafetyEscalation("There was a fire near press P-3");
    expect(result.triggered).toBe(true);
    expect(typeof result.reason).toBe("string");
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
