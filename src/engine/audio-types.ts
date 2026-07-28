export interface AudioEngine {
  start(): Promise<void>;
  playCollision(event: {
    x: number;
    y: number;
    intensity: number;
    pitchClass: number;
    timestamp: number;
  }): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}
