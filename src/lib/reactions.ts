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

export const isRepoId = (v: unknown): v is RepoId => REPOS.some((r) => r.id === v);

const empty = () => Object.fromEntries(REPOS.map((r) => [r.id, emptyCounts()])) as AllReactions;

function parse(raw: Record<string, unknown> | null): AllReactions {
  const all = empty();
  for (const r of REPOS)
    for (const { key } of REACTIONS) all[r.id][key] = Math.max(0, Number(raw?.[`${r.id}:${key}`]) || 0);
  return all;
}

async function load(): Promise<AllReactions> {
  const redis = getRedis();
  if (!redis) return (cache ??= empty());
  try {
    cache = parse(await redis.hgetall(KEY));
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
