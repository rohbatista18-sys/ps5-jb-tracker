import "server-only";
import { env } from "./env";

// Minimal PostgREST client for the counters schema (supabase/001_counters.sql). Uses the secret
// key server-side only; the tables have RLS on and no grants for anon, so nothing is public.
const TIMEOUT_MS = 5000;

export const hasSupabase = () => Boolean(env.supabaseUrl?.startsWith("https://") && env.supabaseSecretKey);

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const key = env.supabaseSecretKey!;
  const res = await fetch(`${env.supabaseUrl!.replace(/\/+$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    redirect: "error", // never forward the key to another host
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status} on ${path.split("?")[0]}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return call<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

// ---- kv (supabase/002_summaries.sql): durable JSON values, first writer wins ----

export async function kvGet<T>(key: string): Promise<T | null> {
  const rows = await call<{ value: T }[]>(`kv?select=value&key=eq.${encodeURIComponent(key)}`, { method: "GET" });
  return rows?.[0]?.value ?? null;
}

/**
 * Stores `value` only if `key` is new, then returns whatever is stored. When several pages or
 * instances generate the same entry at once, all of them end up using the first one written.
 */
export async function kvKeepFirst<T>(key: string, value: T): Promise<T> {
  await call<null>("kv?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ key, value }),
  });
  return (await kvGet<T>(key)) ?? value;
}

/** All counters whose key starts with `prefix`, as { key: value }. */
export async function countersWithPrefix(prefix: string): Promise<Record<string, number>> {
  const rows = await call<{ key: string; value: number }[]>(
    `counters?select=key,value&key=like.${encodeURIComponent(prefix)}*`,
    { method: "GET" },
  );
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value) || 0]));
}
