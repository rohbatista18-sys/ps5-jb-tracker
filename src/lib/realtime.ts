import "server-only";
import { env } from "./env";
import { hasSupabase } from "./supabase";

// Private Supabase Realtime topic. Visitors can only receive on it (supabase/003_realtime_salves.sql);
// only this server, with the secret key, can broadcast.
export const SALVES_TOPIC = "salves";
export const SALVE_EVENT = "salve";

export interface SalvePayload {
  repo: string;
  reaction: string;
  n: string; // random per-send nonce, so the sender's own tab can skip its echo
}

export async function broadcastSalve(payload: SalvePayload): Promise<void> {
  if (!hasSupabase()) return;
  try {
    await fetch(`${env.supabaseUrl!.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: env.supabaseSecretKey!, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: SALVES_TOPIC, event: SALVE_EVENT, payload, private: true }] }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    // Live display is best-effort; the salve itself is already counted.
  }
}
