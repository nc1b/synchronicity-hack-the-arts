import { createRoomTransport } from "./transport";
import type { TracePacket } from "./types";

class FakeChannel {
  private broadcastHandler: ((payload: { event: string; payload: unknown }) => void) | null = null;
  private presenceHandler: ((payload: { event: string }) => void) | null = null;

  on(type: string, filter: { event: string }, callback: (payload: never) => void) {
    if (type === "broadcast" && filter.event === "trace") {
      this.broadcastHandler = callback as typeof this.broadcastHandler;
    }
    if (type === "presence" && filter.event === "sync") {
      this.presenceHandler = callback as typeof this.presenceHandler;
    }
    return this;
  }

  subscribe(callback: (status: string) => void) {
    callback("SUBSCRIBED");
    return this;
  }

  async send() {
    return "ok";
  }

  async track() {
    return "ok";
  }

  async unsubscribe() {
    return "ok";
  }

  emitTrace(packet: TracePacket) {
    this.broadcastHandler?.({ event: "trace", payload: packet });
  }

  emitPresence() {
    this.presenceHandler?.({ event: "sync" });
  }
}

describe("room transport", () => {
  it("emits live status and ignores duplicate or malformed remote packets", async () => {
    const channel = new FakeChannel();
    const transport = createRoomTransport({
      channelFactory: () => channel,
      participantId: "local",
      colorSeed: 1,
    });
    const received: TracePacket[] = [];
    const statuses: string[] = [];
    transport.onTrace((packet) => received.push(packet));
    transport.onStatus((status) => statuses.push(status));

    await transport.connect();
    const packet: TracePacket = {
      participantId: "remote",
      sequence: 1,
      timestamp: 100,
      x: 0.5,
      y: 0.5,
      velocity: 0.4,
      energy: 0.8,
      rhythm: 2,
      pulse: false,
    };
    channel.emitTrace(packet);
    channel.emitTrace(packet);
    channel.emitTrace({ ...packet, sequence: 0 });
    channel.emitTrace({ ...packet, sequence: 2, x: 4 });

    expect(statuses).toContain("live");
    expect(received).toHaveLength(2);
    expect(received[1].x).toBe(1);
  });
});
