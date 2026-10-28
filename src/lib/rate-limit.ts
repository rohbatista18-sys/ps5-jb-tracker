import { createHmac, randomBytes } from "node:crypto";
import { env } from "./env";
import { getRedis } from "./redis";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

const MAX_MEMORY_KEYS = 10_000;
// Fallback when Redis is absent: per server instance, so limits are approximate.
const memory = new Map<string, { count: number; resetAt: number }>();
let nextSweep = 0;

// HMAC key never stored in Redis. Without Redis, a per-process random key is enough.
const processKey = randomBytes(32);
const hmacKey = () => env.redisToken ?? processKey;

/**
 * Keys such as `presence:<ip>` are personal data, so only a keyed hash bound to the current
 * window is stored: it cannot be reversed without the server secret and changes every window,
 * so no identifier outlives `windowSec`.
 */
function bucket(key: string, window: number): string {
  return createHmac("sha256", hmacKey()).update(`${window}\n${key}`).digest("base64url").slice(0, 22);
}

function memoryHit(id: string, windowSec: number, now: number): number {
  if (now >= nextSweep || memory.size >= MAX_MEMORY_KEYS) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    if (memory.size >= MAX_MEMORY_KEYS) memory.clear();
    nextSweep = now + windowSec * 1000;
  }
  const entry = memory.get(id);
  if (entry && entry.resetAt > now) return ++entry.count;
  memory.set(id, { count: 1, resetAt: now + windowSec * 1000 });
  return 1;
}

/** Fixed-window limiter: at most `limit` hits per `windowSec` for `key`. Fails open on Redis errors. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const now = Date.now();
  const window = Math.floor(now / (windowSec * 1000));
  const id = bucket(key, window);
  let count: number | null = null;

  const redis = getRedis();
  if (redis) {
    const redisKey = `rl:v2:${id}`;
    try {
      const [hits] = await redis.multi().incr(redisKey).expire(redisKey, windowSec + 1).exec<[number, number]>();
      count = Number(hits);
    } catch (err) {
      console.error("[rate-limit] redis error", err instanceof Error ? err.message : err);
    }
  }
  if (count === null) count = memoryHit(id, windowSec, now);

  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
