import type {
  BudgetProfile,
  CollisionEvent,
  Rhythm,
  TracePacket,
  TraceState,
} from "./types";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function clampTracePacket(packet: TracePacket): TracePacket | null {
  if (
    !packet ||
    typeof packet.participantId !== "string" ||
    packet.participantId.length < 1 ||
    packet.participantId.length > 64 ||
    !Number.isInteger(packet.sequence) ||
    packet.sequence < 0 ||
    !Number.isFinite(packet.timestamp)
  ) {
    return null;
  }

  const rhythm = Math.min(3, Math.max(0, Math.round(packet.rhythm)));

  return {
    ...packet,
    x: clamp(packet.x),
    y: clamp(packet.y),
    velocity: clamp(packet.velocity),
    energy: clamp(packet.energy),
    rhythm: rhythm as Rhythm,
    pulse: Boolean(packet.pulse),
  };
}

export function quantizeRhythm(intervalMs: number): Rhythm {
  if (!Number.isFinite(intervalMs) || intervalMs <= 60) return 0;
  if (intervalMs <= 150) return 1;
  if (intervalMs <= 450) return 2;
  return 3;
}

export function colorForSeed(seed: number): number {
  const normalized = Math.abs(Math.floor(seed)) % 2;
  return normalized === 0 ? 0x67e8f9 : 0xfbbf24;
}

export function detectCollisions(
  traces: TraceState[],
  timestamp: number,
): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];
  for (let i = 0; i < traces.length; i += 1) {
    for (let j = i + 1; j < traces.length; j += 1) {
      const first = traces[i];
      const second = traces[j];
      const dx = first.x - second.x;
      const dy = first.y - second.y;
      if (Math.hypot(dx, dy) > 0.065) continue;
      const intensity = (first.energy + second.energy) / 2;
      if (intensity < 0.35) continue;
      collisions.push({
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        intensity: Math.round(intensity * 100) / 100,
        pitchClass: (first.rhythm + second.rhythm) % 5,
        timestamp,
      });
    }
  }
  return collisions;
}

export function ghostFrame(timestamp: number, seed: number): TraceState {
  const phase = timestamp / 2200 + seed * 0.73;
  return {
    id: `ghost-${seed}`,
    x: 0.5 + Math.sin(phase) * 0.32,
    y: 0.5 + Math.cos(phase * 0.83) * 0.32,
    energy: 0.58 + Math.sin(phase * 1.7) * 0.22,
    rhythm: (Math.abs(seed) % 4) as Rhythm,
  };
}

export function shouldUseReducedBudget(profile: BudgetProfile): boolean {
  return profile.width < 520 || profile.height < 600 || (profile.deviceMemory ?? 8) <= 2;
}
