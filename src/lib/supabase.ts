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
  return (await res.json()) as T;
}

export function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return call<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

/** All counters whose key starts with `prefix`, as { key: value }. */
export async function countersWithPrefix(prefix: string): Promise<Record<string, number>> {
  const rows = await call<{ key: string; value: number }[]>(
    `counters?select=key,value&key=like.${encodeURIComponent(prefix)}*`,
    { method: "GET" },
  );
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value) || 0]));
}
