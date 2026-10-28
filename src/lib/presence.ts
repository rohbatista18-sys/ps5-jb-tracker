import { env } from "./env";
import { getRedis } from "./redis";
import { hasSupabase, rpc } from "./supabase";
import type { PresenceResponse } from "./types";

const KEY = "presence:v1";
// A single all-time page-view counter; nothing per visitor is stored. The shown total adds
// PAGEVIEWS_BASELINE (views from before the site counted them).
const VIEWS_KEY = "pageviews:v1";
export const PRESENCE_TTL_MS = 120_000; // covers a 30 s heartbeat plus another instance's 60 s flush delay
// Each server instance batches heartbeats and talks to Redis at most once per FLUSH_MS with a
// single pipeline (one ZADD carrying every pending tab id), instead of several commands per
// heartbeat. This keeps the command count independent of how many tabs are open.
const FLUSH_MS = 60_000;
// Supabase has no per-command quota, so flush more often for a fresher count (still one call).
const SUPABASE_FLUSH_MS = 15_000;
const flushInterval = () => (hasSupabase() ? SUPABASE_FLUSH_MS : FLUSH_MS);
const hasStore = () => hasSupabase() || Boolean(getRedis());
const PRUNE_EVERY_MS = 10 * 60_000;
const MAX_MEMORY_ENTRIES = 10_000;

// Local view: tab ids seen recently by this instance (random ids only, no IP/UA), pruned on use.
// Doubles as the fallback store when Redis is absent or unavailable.
const memory = new Map<string, number>();
const pending = new Map<string, number>();
const removed = new Set<string>();
// Views not yet stored in Redis; kept across failed flushes (e.g. over quota) and added on recovery.
let pendingViews = 0;
let memoryViews = 0;
let lastFlush = 0;
let lastPrune = 0;
let flushing: Promise<void> | null = null;
let shared: { online: number; views: number } | null = null;

function pruneMemory(now: number): number {
  const cutoff = now - PRESENCE_TTL_MS;
  for (const [id, seen] of memory) if (seen < cutoff) memory.delete(id);
  return memory.size;
}

async function flushSupabase(beats: [string, number][], gone: string[], views: number) {
  const [row] = await rpc<{ online: number; pageviews: number }[]>("presence_flush", {
    beats: Object.fromEntries(beats),
    gone,
    ttl_seconds: PRESENCE_TTL_MS / 1000,
    views,
  });
  return { online: Number(row?.online) || 0, views: Number(row?.pageviews) || 0 };
}

async function flush(now: number) {
  const redis = getRedis();
  if (!hasSupabase() && !redis) return;
  const beats = [...pending];
  const members = beats.map(([member, score]) => ({ member, score }));
  const gone = [...removed];
  const views = pendingViews;
  pending.clear();
  removed.clear();
  pendingViews = 0;
  try {
    if (hasSupabase()) {
      shared = await flushSupabase(beats, gone, views);
      lastFlush = now;
      return;
    }
    const p = redis!.pipeline();
    if (members.length) p.zadd(KEY, members[0], ...members.slice(1));
    if (gone.length) p.zrem(KEY, ...gone);
    if (now - lastPrune > PRUNE_EVERY_MS) {
      p.zremrangebyscore(KEY, 0, now - PRESENCE_TTL_MS);
      lastPrune = now;
    }
    p.zcount(KEY, now - PRESENCE_TTL_MS, "+inf");
    if (views) p.incrby(VIEWS_KEY, views);
    else p.get(VIEWS_KEY);
    const results = await p.exec<unknown[]>();
    shared = { online: Number(results[results.length - 2]) || 0, views: Number(results[results.length - 1]) || 0 };
    lastFlush = now;
  } catch (err) {
    console.error("[presence] store error", err instanceof Error ? err.message : err);
    pendingViews += views; // keep them for the next flush instead of losing them
    for (const [id, seen] of beats) if (!pending.has(id) && pending.size < MAX_MEMORY_ENTRIES) pending.set(id, seen);
    for (const id of gone) removed.add(id);
    lastFlush = now; // back off a full interval instead of hammering a failing/over-quota Redis
  }
}

async function snapshot(): Promise<PresenceResponse> {
  const now = Date.now();
  const local = { online: pruneMemory(now), views: memoryViews };
  if (hasStore() && (now - lastFlush >= flushInterval() || !shared)) {
    flushing ??= flush(now).finally(() => (flushing = null));
    await flushing;
  }
  // Between flushes (or with Redis down), never show fewer than this instance can see itself;
  // views it holds but has not stored yet are added on top of the last stored total.
  const online = shared ? Math.max(shared.online, local.online) : local.online;
  const views = shared ? shared.views + pendingViews : local.views;
  return { online, visits: env.pageviewsBaseline + views };
}

export async function heartbeat(id: string, newView = false): Promise<PresenceResponse> {
  const now = Date.now();
  pruneMemory(now);
  const isNew = !memory.has(id);
  if (memory.size < MAX_MEMORY_ENTRIES || !isNew) memory.set(id, now);
  pending.set(id, now);
  removed.delete(id);
  if (newView) {
    memoryViews++;
    pendingViews++;
  }
  return snapshot();
}

export async function leave(id: string): Promise<PresenceResponse> {
  memory.delete(id);
  pending.delete(id);
  removed.add(id);
  return snapshot();
}

export async function countOnline(): Promise<PresenceResponse> {
  return snapshot();
}
