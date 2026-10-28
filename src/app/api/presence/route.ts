import type { NextRequest } from "next/server";
import type { PresenceResponse } from "@/lib/types";
import { countOnline, heartbeat, leave } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";
import { blockUntilWindowEnd, clientIp, isForeignOrigin, locallyBlocked, readBody } from "@/lib/request";

const MAX_BODY_BYTES = 200;
const LIMIT_PER_MIN = 30; // ~3 heartbeats/min per tab, leaves room for shared IPs (NAT) and page switches
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: PresenceResponse | { error: string }, status = 200, extra: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

type Parsed = { id: string; leave: boolean; view: boolean } | { error: string; status: number };

async function parseRequest(req: NextRequest): Promise<Parsed> {
  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return { error: "payload too large", status: 413 };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "invalid json", status: 400 };
  }
  if (typeof data !== "object" || data === null) return { error: "invalid body", status: 400 };
  const { id, leave: isLeave, view, visit } = data as { id?: unknown; leave?: unknown; view?: unknown; visit?: unknown };
  if (typeof id !== "string" || !UUID_V4.test(id)) return { error: "invalid id", status: 400 };
  // `visit` is what clients sent before the counter switched to page views; treat it as a view.
  return { id: id.toLowerCase(), leave: isLeave === true, view: view === true || visit === true };
}

async function guard(req: NextRequest): Promise<Response | null> {
  const key = `presence:${clientIp(req)}`;
  const tooMany = () => json({ error: "too many requests" }, 429, { "Retry-After": "60", "X-RateLimit-Remaining": "0" });
  if (locallyBlocked(key)) return tooMany();
  const { ok } = await rateLimit(key, LIMIT_PER_MIN, 60);
  if (ok) return null;
  blockUntilWindowEnd(key, 60);
  return tooMany();
}

async function handleWrite(req: NextRequest, forceLeave: boolean): Promise<Response> {
  if (isForeignOrigin(req)) return json({ error: "forbidden" }, 403);
  const limited = await guard(req);
  if (limited) return limited;
  const parsed = await parseRequest(req);
  if ("error" in parsed) return json({ error: parsed.error }, parsed.status);
  return json(forceLeave || parsed.leave ? await leave(parsed.id) : await heartbeat(parsed.id, parsed.view));
}

export async function GET(req: NextRequest) {
  const limited = await guard(req);
  if (limited) return limited;
  return json(await countOnline());
}

export function POST(req: NextRequest) {
  return handleWrite(req, false);
}

export function DELETE(req: NextRequest) {
  return handleWrite(req, true);
}
