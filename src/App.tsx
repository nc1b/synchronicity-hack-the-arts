import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioEngine } from "./engine/audio";
import { detectCollisions, ghostFrame } from "./engine/domain";
import { createInputSampler } from "./engine/input";
import { createConstellationRenderer, type ConstellationRenderer } from "./engine/renderer";
import { createRoomTransport, type RoomTransport } from "./engine/transport";
import type { CollisionEvent, RoomStatus, TraceState } from "./engine/types";
import "./styles.css";

const participantId = crypto.randomUUID();
const colorSeed = Math.floor(Math.random() * 1000);

function statusCopy(status: RoomStatus) {
  if (status === "live") return "live field";
  if (status === "local") return "local echo";
  if (status === "error") return "reconnecting";
  return "joining the field";
}

export default function App() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const renderer = useRef<ConstellationRenderer | null>(null);
  const transport = useRef<RoomTransport | null>(null);
  const audio = useRef(createAudioEngine());
  const sampler = useRef(createInputSampler(participantId, 45));
  const traces = useRef(new Map<string, TraceState>());
  const lastCollision = useRef(new Map<string, number>());
  const participantCountRef = useRef(0);
  const [entered, setEntered] = useState(false);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [participantCount, setParticipantCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [captureReady, setCaptureReady] = useState(false);

  const updateLocalTrace = useCallback((packet: {
    x: number;
    y: number;
    energy: number;
    rhythm: 0 | 1 | 2 | 3;
  }) => {
    traces.current.set(participantId, {
      id: participantId,
      x: packet.x,
      y: packet.y,
      energy: packet.energy,
      rhythm: packet.rhythm,
    });
  }, []);

  useEffect(() => {
    if (!entered || !canvasHost.current) return;
    let mounted = true;
    let animationFrame = 0;
    const roomTransport = createRoomTransport({ participantId, colorSeed });
    transport.current = roomTransport;
    const cleanupTrace = roomTransport.onTrace((packet) => {
      traces.current.set(packet.participantId, {
        id: packet.participantId,
        x: packet.x,
        y: packet.y,
        energy: packet.energy,
        rhythm: packet.rhythm,
      });
    });
    const cleanupPresence = roomTransport.onPresence((participants) => {
      const count = new Set(participants.map((participant) => participant.participantId)).size;
      participantCountRef.current = count;
      setParticipantCount(count);
    });
    const cleanupStatus = roomTransport.onStatus(setStatus);

    const run = async () => {
      try {
        renderer.current = await createConstellationRenderer(
          canvasHost.current as HTMLDivElement,
          reducedMotion,
        );
        await audio.current.start();
        await roomTransport.connect();
      } catch {
        setStatus("local");
      }
      if (!mounted) return;

      const frame = (timestamp: number) => {
        if (!mounted) return;
        const realCount = participantCountRef.current;
        if (realCount < 2) {
          [1, 2, 3].forEach((seed) => {
            const ghost = ghostFrame(timestamp, seed);
            traces.current.set(ghost.id, ghost);
          });
        } else {
          Array.from(traces.current.keys())
            .filter((id) => id.startsWith("ghost-"))
            .forEach((id) => traces.current.delete(id));
        }

        const visibleTraces = Array.from(traces.current.values());
        const collisions = detectCollisions(visibleTraces, timestamp);
        const newCollisions: CollisionEvent[] = [];
        collisions.forEach((collision) => {
          const key = `${Math.round(collision.x * 20)}:${Math.round(collision.y * 20)}`;
          const previous = lastCollision.current.get(key) ?? -Infinity;
          if (timestamp - previous > 650) {
            lastCollision.current.set(key, timestamp);
            newCollisions.push(collision);
            audio.current.playCollision(collision);
          }
        });
        renderer.current?.update(visibleTraces, newCollisions);
        animationFrame = requestAnimationFrame(frame);
      };
      animationFrame = requestAnimationFrame(frame);
    };

    void run();
    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrame);
      cleanupTrace();
      cleanupPresence();
      cleanupStatus();
      void roomTransport.disconnect();
      transport.current = null;
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [entered, reducedMotion]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!entered || !canvasHost.current) return;
    const rect = canvasHost.current.getBoundingClientRect();
    const packet = sampler.current.pointer(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
      performance.now(),
    );
    if (!packet) return;
    updateLocalTrace(packet);
    transport.current?.sendTrace(packet);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!entered || !canvasHost.current) return;
    const rect = canvasHost.current.getBoundingClientRect();
    const packet = sampler.current.click(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
      performance.now(),
    );
    updateLocalTrace(packet);
    transport.current?.sendTrace(packet);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!entered || event.repeat) return;
    const rhythm = sampler.current.key(performance.now());
    const current = traces.current.get(participantId);
    if (current) traces.current.set(participantId, { ...current, rhythm, energy: 0.8 });
  };

  const start = async () => {
    try {
      await audio.current.start();
    } catch {
      setStatus("local");
    }
    setEntered(true);
  };

  const capture = async () => {
    const blob = await renderer.current?.capture();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "synchronicity-moment.png";
    link.click();
    URL.revokeObjectURL(url);
    setCaptureReady(true);
  };

  return (
    <main className={`app-shell ${entered ? "is-entered" : ""}`}>
      <div
        ref={canvasHost}
        className="canvas-host"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        role="application"
        tabIndex={entered ? 0 : -1}
        aria-label="Synchronicity collaborative art field"
      />

      {!entered && (
        <section className="intro-panel" aria-labelledby="intro-title">
          <p className="eyebrow">Hack the Arts · 2026</p>
          <h1 id="intro-title">Art appears when our movements meet.</h1>
          <p className="intro-copy">
            Move, tap, and play a rhythm. When another visitor crosses your path,
            the field turns the meeting into light and sound.
          </p>
          <button className="enter-button" type="button" onClick={() => void start()}>
            Enter the field
          </button>
          <p className="privacy-note">No camera. No microphone. No account.</p>
        </section>
      )}

      {entered && (
        <>
          <div className="brand-lockup">
            <span className="brand-dot" aria-hidden="true" />
            <span>Synchronicity</span>
          </div>
          <div className="field-status" aria-live="polite">
            <span className={`status-dot status-${status}`} aria-hidden="true" />
            <span>{statusCopy(status)}</span>
            <span className="status-divider">·</span>
            <span>{participantCount || 1} present</span>
          </div>
          <div className="field-controls">
            <button
              className="control-button"
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                audio.current.setMuted(next);
              }}
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => setReducedMotion((value) => !value)}
            >
              {reducedMotion ? "Motion calm" : "Motion full"}
            </button>
            <button className="control-button capture-button" type="button" onClick={() => void capture()}>
              Capture this moment
            </button>
          </div>
          <p className="field-hint">
            Move to draw · tap to pulse · press any key to change the rhythm
          </p>
          {captureReady && <p className="capture-toast">Moment captured.</p>}
        </>
      )}
    </main>
  );
}
