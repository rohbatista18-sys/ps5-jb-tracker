import { createHmac, randomBytes } from "node:crypto";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

const MAX_MEMORY_KEYS = 10_000;
// Per server instance, so limits are approximate across instances. Deliberately not in Redis:
// a Redis-backed limiter costs 2 commands on every request, which alone exhausts the Upstash
// free tier at modest traffic, and abuse here is cosmetic (counters), not costly.
const memory = new Map<string, { count: number; resetAt: number }>();
let nextSweep = 0;

const processKey = randomBytes(32);

/**
 * Keys such as `presence:<ip>` are personal data, so only a keyed hash bound to the current
 * window is held: it cannot be reversed without the per-process secret and changes every window,
 * so no identifier outlives `windowSec`.
 */
function bucket(key: string, window: number): string {
  return createHmac("sha256", processKey).update(`${window}\n${key}`).digest("base64url").slice(0, 22);
}

/** Fixed-window limiter: at most `limit` hits per `windowSec` for `key`. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const now = Date.now();
  const id = bucket(key, Math.floor(now / (windowSec * 1000)));
  if (now >= nextSweep || memory.size >= MAX_MEMORY_KEYS) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    if (memory.size >= MAX_MEMORY_KEYS) memory.clear();
    nextSweep = now + windowSec * 1000;
  }
  const entry = memory.get(id);
  const count = entry && entry.resetAt > now ? ++entry.count : 1;
  if (count === 1) memory.set(id, { count, resetAt: now + windowSec * 1000 });
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
