"use client";

import { useSyncExternalStore } from "react";
import type { ReactionCounts, ReactionKey } from "@/lib/reactions-config";

type AllCounts = Record<string, ReactionCounts>;

const ENDPOINT = "/api/reactions";
const POLL_MS = 30_000;

// One store for all cards: a single GET serves the three of them, polled only while visible.
let state: AllCounts | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((l) => l());

async function refresh() {
  clearTimeout(timer);
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (res.ok) {
      state = (await res.json()) as AllCounts;
      emit();
    }
  } catch {}
  if (listeners.size && !document.hidden) timer = setTimeout(refresh, POLL_MS);
}

const onVisibility = () => {
  if (document.hidden) clearTimeout(timer);
  else refresh();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

/** Returns false when the server rejected the reaction (e.g. rate limited). Optimistic otherwise. */
export async function sendReaction(repo: string, reaction: ReactionKey): Promise<boolean> {
  const prev = state;
  if (state?.[repo]) {
    state = { ...state, [repo]: { ...state[repo], [reaction]: state[repo][reaction] + 1 } };
    emit();
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, reaction }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`reactions ${res.status}`);
    const data = (await res.json()) as { repo: string; counts: ReactionCounts };
    state = { ...(state ?? {}), [data.repo]: data.counts };
    emit();
    return true;
  } catch {
    state = prev;
    emit();
    return false;
  }
}

export function useReactions(repo: string): ReactionCounts | null {
  return useSyncExternalStore(
    subscribe,
    () => state?.[repo] ?? null,
    () => null,
  );
}
