import {
  clampTracePacket,
  colorForSeed,
  detectCollisions,
  ghostFrame,
  quantizeRhythm,
  shouldUseReducedBudget,
} from "./domain";
import type { TracePacket } from "./types";

describe("Synchronicity domain rules", () => {
  it("clamps valid trace packets and rejects malformed packets", () => {
    const packet: TracePacket = {
      participantId: "p1",
      sequence: 4,
      timestamp: 100,
      x: 1.8,
      y: -0.2,
      velocity: 3,
      energy: -1,
      rhythm: 7 as TracePacket["rhythm"],
      pulse: true,
    };

    expect(clampTracePacket(packet)).toEqual({
      ...packet,
      x: 1,
      y: 0,
      velocity: 1,
      energy: 0,
      rhythm: 3,
    });
    expect(clampTracePacket({ ...packet, participantId: "" })).toBeNull();
    expect(clampTracePacket({ ...packet, sequence: -1 })).toBeNull();
  });

  it("maps key intervals into four rhythm buckets", () => {
    expect(quantizeRhythm(0)).toBe(0);
    expect(quantizeRhythm(85)).toBe(1);
    expect(quantizeRhythm(240)).toBe(2);
    expect(quantizeRhythm(900)).toBe(3);
  });

  it("returns deterministic constellation colors", () => {
    expect(colorForSeed(42)).toEqual(colorForSeed(42));
    expect(colorForSeed(42)).not.toEqual(colorForSeed(43));
  });

  it("creates a collision only when two traces are close and energetic", () => {
    const traces = [
      { id: "a", x: 0.5, y: 0.5, energy: 0.9, rhythm: 1 as const },
      { id: "b", x: 0.52, y: 0.51, energy: 0.8, rhythm: 2 as const },
      { id: "c", x: 0.9, y: 0.9, energy: 0.9, rhythm: 0 as const },
    ];

    expect(detectCollisions(traces, 1000)).toEqual([
      {
        x: 0.51,
        y: 0.505,
        intensity: 0.85,
        pitchClass: 3,
        timestamp: 1000,
      },
    ]);
  });

  it("replays deterministic ghost performers", () => {
    expect(ghostFrame(0, 7)).toEqual(ghostFrame(0, 7));
    expect(ghostFrame(0, 7)).not.toEqual(ghostFrame(0, 8));
  });

  it("reduces particle budgets for small or constrained devices", () => {
    expect(shouldUseReducedBudget({ width: 390, height: 844, deviceMemory: 2 })).toBe(true);
    expect(shouldUseReducedBudget({ width: 1440, height: 900, deviceMemory: 16 })).toBe(false);
  });
});
