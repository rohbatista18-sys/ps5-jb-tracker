import "server-only";
import { getRedis } from "./redis";
import { REPOS } from "./repos";
import { countersWithPrefix, hasSupabase, rpc } from "./supabase";
import { REACTIONS, emptyCounts, reactionBaseline, type ReactionCounts, type ReactionKey } from "./reactions-config";
import type { RepoConfig } from "./types";

type RepoId = RepoConfig["id"];
export type AllReactions = Record<RepoId, ReactionCounts>;

// One Redis hash for every dev (field = "<repo>:<reaction>"), read at most once per CACHE_MS per
// server instance, so polling visitors cost no Redis commands. Only aggregate counts are kept —
// nothing about who reacted. Without Redis, counts live per instance and reset on cold start.
// With Supabase configured it is the store instead (counters table, key "reactions:<repo>:<reaction>"),
// read at most once per SUPABASE_CACHE_MS since it has no per-command quota.
const KEY = "reactions:v2";
const SB_PREFIX = "reactions:";
const CACHE_MS = 60_000;
const SUPABASE_CACHE_MS = 15_000;
const cacheMs = () => (hasSupabase() ? SUPABASE_CACHE_MS : CACHE_MS);

let cache: AllReactions | null = null;
let cachedAt = 0;
let loading: Promise<AllReactions> | null = null;
let migrationChecked = false;

export const isRepoId = (v: unknown): v is RepoId => REPOS.some((r) => r.id === v);

/** Stored counts plus the pre-migration estimate, for display. Never written back to the store. */
export const withBaseline = (counts: ReactionCounts): ReactionCounts =>
  Object.fromEntries(REACTIONS.map(({ key }) => [key, counts[key] + reactionBaseline(key)])) as ReactionCounts;

const empty = () => Object.fromEntries(REPOS.map((r) => [r.id, emptyCounts()])) as AllReactions;

function parse(raw: Record<string, unknown> | null): AllReactions {
  const all = empty();
  for (const r of REPOS)
    for (const { key } of REACTIONS) all[r.id][key] = Math.max(0, Number(raw?.[`${r.id}:${key}`]) || 0);
  return all;
}

// One-time move from the old per-dev hashes (reactions:v1:<id>) into the single hash, done by
// whichever instance first finds the new hash empty. HSETNX keeps clicks that already landed.
async function migrateV1(redis: NonNullable<ReturnType<typeof getRedis>>) {
  const p = redis.pipeline();
  for (const r of REPOS) p.hgetall(`reactions:v1:${r.id}`);
  const rows = await p.exec<(Record<string, unknown> | null)[]>();
  const w = redis.pipeline();
  let fields = 0;
  REPOS.forEach((r, i) => {
    for (const [k, v] of Object.entries(rows[i] ?? {})) {
      if (Number(v) > 0) {
        w.hsetnx(KEY, `${r.id}:${k}`, Number(v));
        fields++;
      }
    }
  });
  if (!fields) return;
  for (const r of REPOS) w.del(`reactions:v1:${r.id}`);
  await w.exec();
}

// Clicks this instance could not store (Redis down or over quota), keyed "<repo>:<reaction>".
// They are added on top of the stored totals with HINCRBY as soon as Redis answers again, so
// counts from before and during an outage are summed instead of lost (unless the instance is
// recycled first — that part lives only in memory).
const pendingDeltas = new Map<string, number>();

async function flushPending(redis: NonNullable<ReturnType<typeof getRedis>>) {
  const sent = [...pendingDeltas];
  const p = redis.pipeline();
  for (const [field, n] of sent) p.hincrby(KEY, field, n);
  await p.exec();
  settle(sent);
}

function settle(sent: [string, number][]) {
  for (const [field, n] of sent) {
    const left = (pendingDeltas.get(field) ?? 0) - n;
    if (left > 0) pendingDeltas.set(field, left);
    else pendingDeltas.delete(field);
  }
}

async function incrSupabase(deltas: [string, number][]) {
  const rows = await rpc<{ key: string; value: number }[]>("incr_counters", {
    deltas: Object.fromEntries(deltas.map(([field, n]) => [SB_PREFIX + field, n])),
  });
  return Object.fromEntries(rows.map((r) => [r.key.slice(SB_PREFIX.length), Number(r.value) || 0]));
}

async function loadSupabase(): Promise<AllReactions> {
  if (pendingDeltas.size) {
    const sent = [...pendingDeltas];
    await incrSupabase(sent);
    settle(sent);
  }
  const rows = await countersWithPrefix(SB_PREFIX);
  return parse(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k.slice(SB_PREFIX.length), v])));
}

async function load(): Promise<AllReactions> {
  if (hasSupabase()) {
    try {
      cache = await loadSupabase();
    } catch (err) {
      console.error("[reactions] supabase error", err instanceof Error ? err.message : err);
      cache ??= empty();
    }
    cachedAt = Date.now();
    return cache;
  }
  const redis = getRedis();
  if (!redis) return (cache ??= empty());
  try {
    let raw: Record<string, unknown> | null = await redis.hgetall(KEY);
    if ((!raw || !Object.keys(raw).length) && !migrationChecked) {
      await migrateV1(redis);
      migrationChecked = true;
      raw = null;
    }
    if (pendingDeltas.size) {
      await flushPending(redis);
      raw = null;
    }
    cache = parse(raw ?? (await redis.hgetall(KEY)));
  } catch (err) {
    console.error("[reactions] redis error", err instanceof Error ? err.message : err);
    cache ??= empty();
  }
  cachedAt = Date.now(); // also on errors: retry after a full interval, not on every poll
  return cache;
}

export async function getAllReactions(): Promise<AllReactions> {
  if (cache && Date.now() - cachedAt < cacheMs()) return cache;
  loading ??= load().finally(() => (loading = null));
  return loading;
}

export async function addReaction(id: RepoId, reaction: ReactionKey): Promise<ReactionCounts> {
  const all = await getAllReactions();
  const field = `${id}:${reaction}`;
  if (hasSupabase()) {
    try {
      const values = await incrSupabase([[field, 1]]);
      all[id][reaction] = Math.max(all[id][reaction] + 1, values[field] ?? 0);
      return all[id];
    } catch (err) {
      console.error("[reactions] supabase error", err instanceof Error ? err.message : err);
      pendingDeltas.set(field, (pendingDeltas.get(field) ?? 0) + 1);
      all[id][reaction]++;
      return all[id];
    }
  }
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.hincrby(KEY, `${id}:${reaction}`, 1);
      all[id][reaction] = Math.max(all[id][reaction], value);
      return all[id];
    } catch (err) {
      console.error("[reactions] redis error", err instanceof Error ? err.message : err);
      pendingDeltas.set(field, (pendingDeltas.get(field) ?? 0) + 1);
    }
  }
  all[id][reaction]++;
  return all[id];
}
