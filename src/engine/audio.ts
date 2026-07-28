import type { AudioEngine } from "./audio-types";
import type { CollisionEvent } from "./types";

const PENTATONIC = [261.63, 293.66, 329.63, 392, 523.25];

export function frequencyForCollision(pitchClass: number): number {
  const index = Math.abs(Math.round(pitchClass)) % PENTATONIC.length;
  return PENTATONIC[index];
}

export function volumeForIntensity(intensity: number): number {
  const normalized = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  return 0.01 + normalized * 0.15;
}

type AudioContextFactory = () => AudioContext;

export function createAudioEngine(
  factory: AudioContextFactory = () => {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Web Audio is unavailable");
    return new AudioContextCtor();
  },
): AudioEngine {
  let context: AudioContext | null = null;
  let muted = false;

  return {
    async start() {
      context ??= factory();
      if (context.state === "suspended") await context.resume();
    },
    playCollision(event: CollisionEvent) {
      if (muted || !context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const duration = 0.12 + Math.min(0.3, event.intensity * 0.25);
      oscillator.type = "sine";
      oscillator.frequency.value = frequencyForCollision(event.pitchClass);
      gain.gain.setValueAtTime(volumeForIntensity(event.intensity), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    },
    setMuted(nextMuted) {
      muted = nextMuted;
    },
    destroy() {
      if (context) void context.close();
      context = null;
    },
  };
}
