import "server-only";
import { getRedis } from "./redis";
import { REPOS } from "./repos";
import { REACTIONS, emptyCounts, type ReactionCounts, type ReactionKey } from "./reactions-config";
import type { RepoConfig } from "./types";

type RepoId = RepoConfig["id"];
export type AllReactions = Record<RepoId, ReactionCounts>;

// One Redis hash for every dev (field = "<repo>:<reaction>"), read at most once per CACHE_MS per
// server instance, so polling visitors cost no Redis commands. Only aggregate counts are kept —
// nothing about who reacted. Without Redis, counts live per instance and reset on cold start.
const KEY = "reactions:v2";
const CACHE_MS = 60_000;

let cache: AllReactions | null = null;
let cachedAt = 0;
let loading: Promise<AllReactions> | null = null;
let migrationChecked = false;

export const isRepoId = (v: unknown): v is RepoId => REPOS.some((r) => r.id === v);

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

async function load(): Promise<AllReactions> {
  const redis = getRedis();
  if (!redis) return (cache ??= empty());
  try {
    let raw = await redis.hgetall(KEY);
    if ((!raw || !Object.keys(raw).length) && !migrationChecked) {
      migrationChecked = true;
      await migrateV1(redis);
      raw = await redis.hgetall(KEY);
    }
    cache = parse(raw);
  } catch (err) {
    console.error("[reactions] redis error", err instanceof Error ? err.message : err);
    cache ??= empty();
  }
  cachedAt = Date.now(); // also on errors: retry after a full interval, not on every poll
  return cache;
}

export async function getAllReactions(): Promise<AllReactions> {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
  loading ??= load().finally(() => (loading = null));
  return loading;
}

export async function addReaction(id: RepoId, reaction: ReactionKey): Promise<ReactionCounts> {
  const all = await getAllReactions();
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.hincrby(KEY, `${id}:${reaction}`, 1);
      all[id][reaction] = Math.max(all[id][reaction], value);
      return all[id];
    } catch (err) {
      console.error("[reactions] redis error", err instanceof Error ? err.message : err);
    }
  }
  all[id][reaction]++;
  return all[id];
}
