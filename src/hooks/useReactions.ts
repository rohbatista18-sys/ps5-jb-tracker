"use client";

import { useSyncExternalStore } from "react";
import type { ReactionCounts, ReactionKey } from "@/lib/reactions-config";

type AllCounts = Record<string, ReactionCounts>;

export interface QuotaState {
  remaining: number;
  resetAt: string;
}

interface State {
  counts: AllCounts;
  quota: QuotaState | null;
}

const ENDPOINT = "/api/reactions";
const POLL_MS = 60_000;

// One store for all cards: a single GET serves the three of them (counts + this person's hourly
// quota), polled only while visible.
let state: State | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((l) => l());

async function refresh() {
  clearTimeout(timer);
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { counts: AllCounts } & QuotaState;
      state = { counts: data.counts, quota: { remaining: data.remaining, resetAt: data.resetAt } };
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

export type SendResult = "ok" | "quota" | "error";

// Nonces of salves sent from this tab: the live broadcast echoes them back, and they are skipped.
const ownNonces = new Set<string>();
export const isOwnSalve = (n: unknown) => typeof n === "string" && ownNonces.has(n);

function newNonce() {
  const n = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  ownNonces.add(n);
  if (ownNonces.size > 20) ownNonces.delete(ownNonces.values().next().value!);
  return n;
}

/** Optimistic: bumps the count right away and rolls back if the server refuses. */
export async function sendReaction(repo: string, reaction: ReactionKey): Promise<SendResult> {
  const prev = state;
  if (state?.counts[repo]) {
    const counts = { ...state.counts, [repo]: { ...state.counts[repo], [reaction]: state.counts[repo][reaction] + 1 } };
    const quota = state.quota && { ...state.quota, remaining: Math.max(0, state.quota.remaining - 1) };
    state = { counts, quota };
    emit();
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, reaction, n: newNonce() }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Partial<{ repo: string; counts: ReactionCounts; error: string } & QuotaState>;
    if (res.status === 429 && data.error === "quota") {
      state = prev && { ...prev, quota: { remaining: 0, resetAt: data.resetAt ?? prev.quota?.resetAt ?? "" } };
      emit();
      return "quota";
    }
    if (!res.ok || !data.repo || !data.counts) throw new Error(`reactions ${res.status}`);
    state = {
      counts: { ...(state?.counts ?? {}), [data.repo]: data.counts },
      quota: { remaining: data.remaining ?? 0, resetAt: data.resetAt ?? "" },
    };
    emit();
    return "ok";
  } catch {
    state = prev;
    emit();
    return "error";
  }
}

export function useReactions(repo: string): ReactionCounts | null {
  return useSyncExternalStore(subscribe, () => state?.counts[repo] ?? null, () => null);
}

export function useReactionQuota(): QuotaState | null {
  return useSyncExternalStore(subscribe, () => state?.quota ?? null, () => null);
}
