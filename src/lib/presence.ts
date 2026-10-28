import { getRedis } from "./redis";
import type { PresenceResponse } from "./types";

const KEY = "presence:v1";
const VISITS_KEY = "visits:v1"; // a single all-time counter; nothing per visitor is stored
export const PRESENCE_TTL_MS = 35_000;
const KEY_TTL_SEC = 120;
const MAX_MEMORY_ENTRIES = 10_000;

// Fallback when Redis is absent: per server instance, so on serverless each
// instance sees only its own visitors. The count is approximate by design.
// Holds only random tab ids (no IP/UA) and is pruned on every call.
const memory = new Map<string, number>();
let memoryVisits = 0;

function pruneMemory(now: number): number {
  const cutoff = now - PRESENCE_TTL_MS;
  for (const [id, seen] of memory) if (seen < cutoff) memory.delete(id);
  return memory.size;
}

async function redisState(op: "add" | "rem" | "none", id?: string, newVisitor = false): Promise<PresenceResponse | null> {
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
    tx.get(VISITS_KEY);
    const results = await tx.exec<unknown[]>();
    const online = Number(results[results.length - 3]) || 0;
    let visits = Number(results[results.length - 1]) || 0;
    // Count a visitor only when the browser says it is its first visit AND this tab id is
    // brand new, so replaying the flag on later heartbeats cannot inflate the total.
    const added = op === "add" && Number(results[0]) === 1;
    if (newVisitor && added) visits = await redis.incr(VISITS_KEY);
    return { online, visits };
  } catch (err) {
    console.error("[presence] redis error", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function heartbeat(id: string, newVisitor = false): Promise<PresenceResponse> {
  const state = await redisState("add", id, newVisitor);
  if (state) return state;
  const now = Date.now();
  pruneMemory(now);
  const isNew = !memory.has(id);
  if (memory.size < MAX_MEMORY_ENTRIES || !isNew) memory.set(id, now);
  if (newVisitor && isNew) memoryVisits++;
  return { online: memory.size, visits: memoryVisits };
}

export async function leave(id: string): Promise<PresenceResponse> {
  const state = await redisState("rem", id);
  if (state) return state;
  memory.delete(id);
  return { online: pruneMemory(Date.now()), visits: memoryVisits };
}

export async function countOnline(): Promise<PresenceResponse> {
  const state = await redisState("none");
  if (state) return state;
  return { online: pruneMemory(Date.now()), visits: memoryVisits };
}
