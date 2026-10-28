import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "./env";
import { REACTION_QUOTA } from "./reactions-config";
import { hasSupabase, rpc } from "./supabase";

// Per-person salve quota (REACTION_QUOTA per clock hour), shared by every server instance through
// the Supabase counters table under "quota:<hour>:<hash>". The hash is an HMAC of the client IP
// keyed with a server secret and bound to the hour, so the IP itself is never stored and rows
// can't be linked across hours; they are deleted once their hour is over.
const HOUR_MS = 3_600_000;
const fallbackKey = randomBytes(32);

export interface Quota {
  remaining: number;
  resetAt: string; // ISO, start of the next hour
}

const hourOf = (now: number) => Math.floor(now / HOUR_MS);

function bucket(ip: string, hour: number): string {
  const digest = createHmac("sha256", env.supabaseSecretKey ?? fallbackKey).update(`${hour}\n${ip}`).digest("base64url");
  return `quota:${hour}:${digest.slice(0, 22)}`;
}

const quotaFrom = (used: number, hour: number): Quota => ({
  remaining: Math.max(0, REACTION_QUOTA - used),
  resetAt: new Date((hour + 1) * HOUR_MS).toISOString(),
});

// Without Supabase (or if it fails): per-instance memory, approximate across instances.
const memory = new Map<string, number>();

function memoryUse(key: string, hour: number, add: number): number {
  for (const k of memory.keys()) if (!k.startsWith(`quota:${hour}:`)) memory.delete(k);
  const used = (memory.get(key) ?? 0) + add;
  if (add) memory.set(key, used);
  return used;
}

let lastCleanupHour = 0;

async function cleanup(hour: number) {
  if (lastCleanupHour === hour) return;
  lastCleanupHour = hour;
  const url = `${env.supabaseUrl!.replace(/\/+$/, "")}/rest/v1/counters?and=(key.like."quota:*",key.lt."quota:${hour}")`;
  await fetch(url, {
    method: "DELETE",
    headers: { apikey: env.supabaseSecretKey! },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
    redirect: "error",
  }).catch(() => {});
}

/** How many salves this person has left this hour (no side effects). */
export async function peekQuota(ip: string): Promise<Quota> {
  const now = Date.now();
  const hour = hourOf(now);
  const key = bucket(ip, hour);
  if (hasSupabase()) {
    try {
      const res = await fetch(
        `${env.supabaseUrl!.replace(/\/+$/, "")}/rest/v1/counters?select=value&key=eq.${encodeURIComponent(key)}`,
        { headers: { apikey: env.supabaseSecretKey! }, signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" },
      );
      if (res.ok) {
        const [row] = (await res.json()) as { value: number }[];
        return quotaFrom(Number(row?.value) || 0, hour);
      }
    } catch {}
  }
  return quotaFrom(memoryUse(key, hour, 0), hour);
}

/** Uses one salve if any is left. Atomic in Supabase, so parallel clicks can't exceed the quota. */
export async function takeQuota(ip: string): Promise<Quota & { ok: boolean }> {
  const now = Date.now();
  const hour = hourOf(now);
  const key = bucket(ip, hour);
  let used: number | null = null;
  if (hasSupabase()) {
    try {
      const [row] = await rpc<{ key: string; value: number }[]>("incr_counters", { deltas: { [key]: 1 } });
      used = Number(row?.value) || 0;
      void cleanup(hour);
    } catch (err) {
      console.error("[quota] supabase error", err instanceof Error ? err.message : err);
    }
  }
  used ??= memoryUse(key, hour, 1);
  return { ok: used <= REACTION_QUOTA, ...quotaFrom(used, hour) };
}
