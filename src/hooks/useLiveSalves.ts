"use client";

import { useEffect, useRef } from "react";
import { isReactionAllowed, isReactionKey, REACTIONS, type Reaction } from "@/lib/reactions-config";
import { isOwnSalve } from "./useReactions";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TOPIC = "salves";
const EVENT = "salve";
const MIN_GAP_MS = 350; // a burst of salves is spread out instead of drawn all at once
const MAX_QUEUE = 8;

/**
 * Salves other visitors send, live, over a receive-only Supabase Realtime channel. Connected only
 * while the tab is visible (free-tier connection limits); nothing about this visitor is sent.
 */
export function useLiveSalves(onSalve: (r: Reaction) => void) {
  const handler = useRef(onSalve);
  useEffect(() => {
    handler.current = onSalve;
  });

  useEffect(() => {
    if (!URL?.startsWith("https://") || !KEY) return;
    type Client = import("@supabase/realtime-js").RealtimeClient;
    let client: Client | null = null;
    let disposed = false;
    const queue: Reaction[] = [];
    let drainTimer: ReturnType<typeof setTimeout> | undefined;

    const drain = () => {
      drainTimer = undefined;
      const r = queue.shift();
      if (!r) return;
      handler.current(r);
      if (queue.length) drainTimer = setTimeout(drain, MIN_GAP_MS);
    };

    const onMessage = (msg: { payload?: { repo?: unknown; reaction?: unknown; n?: unknown } }) => {
      const p = msg.payload;
      if (!p || typeof p.repo !== "string" || !isReactionKey(p.reaction) || !isReactionAllowed(p.repo, p.reaction)) return;
      if (isOwnSalve(p.n) || document.hidden) return;
      const r = REACTIONS.find((x) => x.key === p.reaction);
      if (!r || queue.length >= MAX_QUEUE) return;
      queue.push(r);
      if (!drainTimer) drain();
    };

    const connect = async () => {
      if (client || disposed || document.hidden) return;
      const { RealtimeClient } = await import("@supabase/realtime-js");
      if (disposed || document.hidden || client) return;
      client = new RealtimeClient(`${URL.replace(/^https/, "wss")}/realtime/v1`, { params: { apikey: KEY } });
      client.channel(TOPIC, { config: { private: true } }).on("broadcast", { event: EVENT }, onMessage).subscribe();
    };

    const disconnect = () => {
      if (!client) return;
      client.removeAllChannels();
      client.disconnect();
      client = null;
    };

    const onVisibility = () => (document.hidden ? disconnect() : void connect());
    document.addEventListener("visibilitychange", onVisibility);
    void connect();

    return () => {
      disposed = true;
      clearTimeout(drainTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, []);
}
