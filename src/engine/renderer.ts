import { Application, Graphics } from "pixi.js";
import { colorForSeed } from "./domain";
import type { CollisionEvent, TraceState } from "./types";

type Point = { x: number; y: number; timestamp: number; energy: number };
type Burst = CollisionEvent & { born: number };

export type ConstellationRenderer = {
  update(traces: TraceState[], collisions: CollisionEvent[]): void;
  capture(): Promise<Blob | null>;
  destroy(): void;
};

const hashId = (value: string) =>
  Array.from(value).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);

export async function createConstellationRenderer(
  host: HTMLElement,
  reducedMotion: boolean,
): Promise<ConstellationRenderer> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundColor: 0x03050a,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preserveDrawingBuffer: true,
  });
  host.appendChild(app.canvas);

  const glowLayer = new Graphics();
  const traceLayer = new Graphics();
  const burstLayer = new Graphics();
  app.stage.addChild(glowLayer, traceLayer, burstLayer);

  let activeTraces: TraceState[] = [];
  let bursts: Burst[] = [];
  const trails = new Map<string, Point[]>();

  const update = (traces: TraceState[], collisions: CollisionEvent[]) => {
    activeTraces = traces;
    const now = performance.now();
    traces.forEach((trace) => {
      const points = trails.get(trace.id) ?? [];
      points.push({
        x: trace.x * app.screen.width,
        y: trace.y * app.screen.height,
        timestamp: now,
        energy: trace.energy,
      });
      const maxPoints = reducedMotion ? 4 : 26;
      trails.set(trace.id, points.slice(-maxPoints));
    });
    bursts = bursts.concat(collisions.map((collision) => ({ ...collision, born: now }))).slice(-30);
  };

  const draw = () => {
    const now = performance.now();
    glowLayer.clear();
    traceLayer.clear();
    burstLayer.clear();

    trails.forEach((points, id) => {
      const freshPoints = points.filter((point) => now - point.timestamp < 2600);
      trails.set(id, freshPoints);
      if (freshPoints.length === 0) return;
      const color = colorForSeed(hashId(id));
      freshPoints.forEach((point, index) => {
        const age = (now - point.timestamp) / 2600;
        const alpha = Math.max(0.08, (1 - age) * 0.72);
        const radius = 1.5 + point.energy * 4;
        traceLayer.circle(point.x, point.y, radius).fill({ color, alpha });
        if (index > 0) {
          const previous = freshPoints[index - 1];
          traceLayer
            .moveTo(previous.x, previous.y)
            .lineTo(point.x, point.y)
            .stroke({ width: 1 + point.energy * 2, color, alpha: alpha * 0.7 });
        }
      });
    });

    activeTraces.forEach((trace) => {
      const color = colorForSeed(hashId(trace.id));
      const x = trace.x * app.screen.width;
      const y = trace.y * app.screen.height;
      glowLayer.circle(x, y, 10 + trace.energy * 18).fill({
        color,
        alpha: reducedMotion ? 0.05 : 0.1,
      });
    });

    bursts = bursts.filter((burst) => now - burst.born < 900);
    bursts.forEach((burst) => {
      const age = (now - burst.born) / 900;
      const x = burst.x * app.screen.width;
      const y = burst.y * app.screen.height;
      const radius = 10 + age * (reducedMotion ? 20 : 70);
      const alpha = Math.max(0, 0.8 * (1 - age));
      burstLayer
        .circle(x, y, radius)
        .stroke({ width: 2 + burst.intensity * 3, color: 0xfef3c7, alpha });
      if (!reducedMotion) {
        burstLayer.circle(x, y, radius * 0.25).fill({ color: 0xffffff, alpha });
      }
    });
  };

  app.ticker.add(draw);

  return {
    update,
    async capture() {
      const extractCanvas = app.renderer.extract.canvas;
      const canvas = extractCanvas ? extractCanvas.call(app.renderer.extract, app.stage) : app.canvas;
      if (!canvas.toBlob) return null;
      return new Promise((resolve) => canvas.toBlob?.(resolve, "image/png"));
    },
    destroy() {
      app.ticker.stop();
      app.destroy(true, { children: true, texture: true });
      trails.clear();
    },
  };
}
