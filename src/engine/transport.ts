import { createClient } from "@supabase/supabase-js";
import { clampTracePacket } from "./domain";
import type {
  PresencePayload,
  RoomStatus,
  TracePacket,
} from "./types";

type ChannelLike = {
  on(
    type: string,
    filter: { event: string },
    callback: (payload: { payload?: unknown }) => void,
  ): ChannelLike;
  subscribe(callback: (status: string) => void): ChannelLike;
  send(payload: unknown): Promise<unknown>;
  track(payload: PresencePayload): Promise<unknown>;
  unsubscribe(): Promise<unknown>;
  presenceState?: () => Record<string, PresencePayload[]>;
};

type TransportOptions = {
  participantId: string;
  colorSeed: number;
  channelFactory?: () => ChannelLike | null;
};

export interface RoomTransport {
  connect(): Promise<void>;
  sendTrace(packet: TracePacket): void;
  onTrace(callback: (packet: TracePacket) => void): () => void;
  onPresence(callback: (participants: PresencePayload[]) => void): () => void;
  onStatus(callback: (status: RoomStatus) => void): () => void;
  disconnect(): Promise<void>;
}

const defaultChannelFactory = (): ChannelLike | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key);
  return client.channel("synchronicity:main");
};

const notify = <T>(listeners: Set<(value: T) => void>, value: T) => {
  listeners.forEach((listener) => listener(value));
};

export function createRoomTransport(options: TransportOptions): RoomTransport {
  const traceListeners = new Set<(packet: TracePacket) => void>();
  const presenceListeners = new Set<(participants: PresencePayload[]) => void>();
  const statusListeners = new Set<(status: RoomStatus) => void>();
  const latestSequences = new Map<string, number>();
  const channelFactory = options.channelFactory ?? defaultChannelFactory;
  let channel: ChannelLike | null = null;
  let status: RoomStatus = "connecting";

  const setStatus = (next: RoomStatus) => {
    status = next;
    notify(statusListeners, next);
  };

  return {
    async connect() {
      setStatus("connecting");
      channel = channelFactory();
      if (!channel) {
        setStatus("local");
        return;
      }

      channel
        .on("broadcast", { event: "trace" }, ({ payload }) => {
          if (!payload || typeof payload !== "object") return;
          const packet = clampTracePacket(payload as TracePacket);
          if (!packet || packet.participantId === options.participantId) return;
          const previous = latestSequences.get(packet.participantId);
          if (previous !== undefined && packet.sequence <= previous) return;
          latestSequences.set(packet.participantId, packet.sequence);
          notify(traceListeners, packet);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState?.() ?? {};
          const participants = Object.values(state).flat();
          notify(presenceListeners, participants);
        });

      await new Promise<void>((resolve) => {
        channel?.subscribe((nextStatus) => {
          if (nextStatus === "SUBSCRIBED") {
            void channel?.track({
              participantId: options.participantId,
              colorSeed: options.colorSeed,
            });
            setStatus("live");
            resolve();
          } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
            setStatus("local");
            resolve();
          }
        });
      });
    },
    sendTrace(packet) {
      if (status !== "live" || !channel) return;
      void channel.send({
        type: "broadcast",
        event: "trace",
        payload: packet,
      });
    },
    onTrace(callback) {
      traceListeners.add(callback);
      return () => traceListeners.delete(callback);
    },
    onPresence(callback) {
      presenceListeners.add(callback);
      return () => presenceListeners.delete(callback);
    },
    onStatus(callback) {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
    async disconnect() {
      if (channel) await channel.unsubscribe();
      channel = null;
      setStatus("local");
    },
  };
}
