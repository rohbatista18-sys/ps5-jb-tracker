import { getRedis } from "./redis";

const KEY = "presence:v1";
export const PRESENCE_TTL_MS = 35_000;
const KEY_TTL_SEC = 120;
const MAX_MEMORY_ENTRIES = 10_000;

// Fallback when Redis is absent: per server instance, so on serverless each
// instance sees only its own visitors. The count is approximate by design.
// Holds only random tab ids (no IP/UA) and is pruned on every call.
const memory = new Map<string, number>();

function pruneMemory(now: number): number {
  const cutoff = now - PRESENCE_TTL_MS;
  for (const [id, seen] of memory) if (seen < cutoff) memory.delete(id);
  return memory.size;
}

async function redisCount(op: "add" | "rem" | "none", id?: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  const now = Date.now();
  try {
    const tx = redis.multi();
    if (op === "add" && id) tx.zadd(KEY, { score: now, member: id });
    if (op === "rem" && id) tx.zrem(KEY, id);
    tx.zremrangebyscore(KEY, 0, now - PRESENCE_TTL_MS);
    tx.zcard(KEY);
    tx.expire(KEY, KEY_TTL_SEC);
    const results = await tx.exec<unknown[]>();
    return Number(results[results.length - 2]) || 0;
  } catch (err) {
    console.error("[presence] redis error", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function heartbeat(id: string): Promise<number> {
  const count = await redisCount("add", id);
  if (count !== null) return count;
  const now = Date.now();
  if (pruneMemory(now) < MAX_MEMORY_ENTRIES || memory.has(id)) memory.set(id, now);
  return memory.size;
}

export async function leave(id: string): Promise<number> {
  const count = await redisCount("rem", id);
  if (count !== null) return count;
  memory.delete(id);
  return pruneMemory(Date.now());
}

export async function countOnline(): Promise<number> {
  const count = await redisCount("none");
  if (count !== null) return count;
  return pruneMemory(Date.now());
}
