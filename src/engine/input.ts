import { quantizeRhythm } from "./domain";
import type { Rhythm, TracePacket } from "./types";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function pointerMetrics(
  previousX: number,
  previousY: number,
  x: number,
  y: number,
  elapsedMs: number,
): { velocity: number; energy: number } {
  const distance = Math.hypot(x - previousX, y - previousY);
  const seconds = Math.max(1, elapsedMs) / 1000;
  const velocity = clamp(distance / seconds);
  return { velocity, energy: clamp(velocity * 1.1) };
}

export function createInputSampler(participantId: string, minIntervalMs = 60) {
  let previous = { x: 0.5, y: 0.5, timestamp: -Infinity };
  let sequence = 0;
  let lastKeyTimestamp: number | null = null;
  let lastPacket: TracePacket | null = null;
  let hasSample = false;

  const buildPacket = (
    x: number,
    y: number,
    timestamp: number,
    pulse: boolean,
  ): TracePacket => {
    const metrics = pointerMetrics(
      previous.x,
      previous.y,
      x,
      y,
      timestamp - previous.timestamp,
    );
    const packet: TracePacket = {
      participantId,
      sequence: sequence++,
      timestamp,
      x: clamp(x),
      y: clamp(y),
      velocity: metrics.velocity,
      energy: metrics.energy,
      rhythm: lastKeyTimestamp === null
        ? 0
        : quantizeRhythm(timestamp - lastKeyTimestamp),
      pulse,
    };
    previous = { x: packet.x, y: packet.y, timestamp };
    lastPacket = packet;
    return packet;
  };

  return {
    pointer(x: number, y: number, timestamp: number): TracePacket | null {
      if (!hasSample) {
        previous = { x: clamp(x), y: clamp(y), timestamp };
        hasSample = true;
        return null;
      }
      if (!Number.isFinite(timestamp) || timestamp - previous.timestamp < minIntervalMs) {
        return null;
      }
      return buildPacket(x, y, timestamp, false);
    },
    click(x: number, y: number, timestamp: number): TracePacket {
      return buildPacket(x, y, timestamp, true);
    },
    key(timestamp: number): Rhythm {
      const rhythm = lastKeyTimestamp === null
        ? 0
        : quantizeRhythm(timestamp - lastKeyTimestamp);
      lastKeyTimestamp = timestamp;
      if (lastPacket) lastPacket.rhythm = rhythm;
      return rhythm;
    },
  };
}
