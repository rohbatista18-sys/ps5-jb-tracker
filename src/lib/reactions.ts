import "server-only";
import { getRedis } from "./redis";
import { REPOS } from "./repos";
import { REACTIONS, emptyCounts, type ReactionCounts, type ReactionKey } from "./reactions-config";
import type { RepoConfig } from "./types";

type RepoId = RepoConfig["id"];
export type AllReactions = Record<RepoId, ReactionCounts>;

// One Redis hash per dev: field = reaction key, value = count. Only aggregate counts are kept —
// nothing about who reacted. Without Redis, counts live per instance and reset on cold start.
const key = (id: RepoId) => `reactions:v1:${id}`;
const memory = new Map<RepoId, ReactionCounts>();

export const isRepoId = (v: unknown): v is RepoId => REPOS.some((r) => r.id === v);

function normalize(raw: Record<string, unknown> | null): ReactionCounts {
  const counts = emptyCounts();
  for (const { key: k } of REACTIONS) counts[k] = Math.max(0, Number(raw?.[k]) || 0);
  return counts;
}

export async function getAllReactions(): Promise<AllReactions> {
  const redis = getRedis();
  if (redis) {
    try {
      const tx = redis.multi();
      for (const r of REPOS) tx.hgetall(key(r.id));
      const rows = await tx.exec<(Record<string, unknown> | null)[]>();
      return Object.fromEntries(REPOS.map((r, i) => [r.id, normalize(rows[i])])) as AllReactions;
    } catch (err) {
      console.error("[reactions] redis error", err instanceof Error ? err.message : err);
    }
  }
  return Object.fromEntries(REPOS.map((r) => [r.id, memory.get(r.id) ?? emptyCounts()])) as AllReactions;
}

export async function addReaction(id: RepoId, reaction: ReactionKey): Promise<ReactionCounts> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.hincrby(key(id), reaction, 1);
      return normalize(await redis.hgetall(key(id)));
    } catch (err) {
      console.error("[reactions] redis error", err instanceof Error ? err.message : err);
    }
  }
  const counts = memory.get(id) ?? emptyCounts();
  counts[reaction]++;
  memory.set(id, counts);
  return counts;
}
