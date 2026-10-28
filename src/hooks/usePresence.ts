"use client";

import { useEffect, useState } from "react";
import type { PresenceResponse } from "@/lib/types";

const ENDPOINT = "/api/presence";
const STORAGE_KEY = "ps5jb:visitor-id";
const HEARTBEAT_MS = 20_000;
const MAX_BACKOFF_MS = 120_000;
const MIN_GAP_MS = 5_000;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let memoryId: string | null = null;

function uuidV4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID().toLowerCase();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** One stable id per tab (sessionStorage), falling back to an in-memory id. Client-only. */
export function getVisitorId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && UUID_V4.test(stored)) return stored;
    const id = uuidV4();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return (memoryId ??= uuidV4());
  }
}

export function usePresence(): { online: number | null } {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    const id = getVisitorId();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;
    let lastBeat = 0;
    let active = true;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (active && !document.hidden) timer = setTimeout(beat, ms);
    };

    const retryDelay = (res?: Response) => {
      const retryAfter = Number(res?.headers.get("retry-after"));
      if (retryAfter > 0) return Math.min(MAX_BACKOFF_MS, retryAfter * 1000);
      const exp = Math.min(MAX_BACKOFF_MS, HEARTBEAT_MS * 2 ** failures);
      return exp * (0.75 + Math.random() * 0.5);
    };

    async function beat() {
      controller?.abort();
      controller = new AbortController();
      lastBeat = Date.now();
      let res: Response | undefined;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`presence ${res.status}`);
        const data = (await res.json()) as Partial<PresenceResponse>;
        if (typeof data.online === "number" && Number.isFinite(data.online)) {
          setOnline(Math.max(0, Math.floor(data.online)));
        }
        failures = 0;
        schedule(HEARTBEAT_MS);
      } catch (err) {
        if (controller.signal.aborted && (err as Error).name === "AbortError") return;
        failures++;
        schedule(retryDelay(res));
      }
    }

    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else schedule(Math.max(0, lastBeat + MIN_GAP_MS - Date.now()));
    };

    const onPageHide = () => {
      clearTimeout(timer);
      const body = new Blob([JSON.stringify({ id, leave: true })], { type: "text/plain" });
      navigator.sendBeacon?.(ENDPOINT, body);
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) schedule(0);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    if (!document.hidden) beat();

    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return { online };
}
