export type RoomStatus = "connecting" | "live" | "local" | "error";

export type Rhythm = 0 | 1 | 2 | 3;

export type TracePacket = {
  participantId: string;
  sequence: number;
  timestamp: number;
  x: number;
  y: number;
  velocity: number;
  energy: number;
  rhythm: Rhythm;
  pulse: boolean;
};

export type PresencePayload = {
  participantId: string;
  colorSeed: number;
};

export type CollisionEvent = {
  x: number;
  y: number;
  intensity: number;
  pitchClass: number;
  timestamp: number;
};

export type TraceState = {
  id: string;
  x: number;
  y: number;
  energy: number;
  rhythm: Rhythm;
};

export type BudgetProfile = {
  width: number;
  height: number;
  deviceMemory?: number;
};
