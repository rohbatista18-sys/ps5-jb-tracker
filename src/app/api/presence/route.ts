import type { NextRequest } from "next/server";
import type { PresenceResponse } from "@/lib/types";
import { countOnline, heartbeat, leave } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 200;
const LIMIT_PER_MIN = 30; // ~3 heartbeats/min per tab, leaves room for shared IPs (NAT) and page switches
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: PresenceResponse | { error: string }, status = 200, extra: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

// IPv6 clients usually own a whole /64, so limit per /64 instead of per address.
function ipv6Prefix(ip: string): string {
  const [head, tail = ""] = ip.toLowerCase().split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

// Used only as rate-limit input; rate-limit.ts stores a keyed, per-window hash, never the IP.
function clientIp(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  if (!ip) return "unknown";
  return ip.includes(":") && !ip.startsWith("::ffff:") ? ipv6Prefix(ip) : ip;
}

// Browsers always send Origin on cross-site POST/DELETE (including sendBeacon);
// rejecting foreign origins stops other sites from inflating the count via their visitors.
function isForeignOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  // Host only: X-Forwarded-Host is client-controllable when not overwritten by the platform.
  const host = req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function readBody(req: NextRequest): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

type Parsed = { id: string; leave: boolean } | { error: string; status: number };

async function parseRequest(req: NextRequest): Promise<Parsed> {
  const raw = await readBody(req);
  if (raw === null) return { error: "payload too large", status: 413 };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "invalid json", status: 400 };
  }
  if (typeof data !== "object" || data === null) return { error: "invalid body", status: 400 };
  const { id, leave: isLeave } = data as { id?: unknown; leave?: unknown };
  if (typeof id !== "string" || !UUID_V4.test(id)) return { error: "invalid id", status: 400 };
  return { id: id.toLowerCase(), leave: isLeave === true };
}

// Per-instance short-circuit so a flooding client stops costing Redis commands once limited.
// Holds the bucket key only until the window ends; swept on every check.
const blockedUntil = new Map<string, number>();

function locallyBlocked(key: string, now: number): boolean {
  for (const [k, until] of blockedUntil) if (until <= now) blockedUntil.delete(k);
  return blockedUntil.has(key);
}

async function guard(req: NextRequest): Promise<Response | null> {
  const key = `presence:${clientIp(req)}`;
  const now = Date.now();
  const tooMany = () => json({ error: "too many requests" }, 429, { "Retry-After": "60", "X-RateLimit-Remaining": "0" });
  if (locallyBlocked(key, now)) return tooMany();
  const { ok } = await rateLimit(key, LIMIT_PER_MIN, 60);
  if (ok) return null;
  if (blockedUntil.size < 10_000) blockedUntil.set(key, (Math.floor(now / 60_000) + 1) * 60_000);
  return tooMany();
}

async function handleWrite(req: NextRequest, forceLeave: boolean): Promise<Response> {
  if (isForeignOrigin(req)) return json({ error: "forbidden" }, 403);
  const limited = await guard(req);
  if (limited) return limited;
  const parsed = await parseRequest(req);
  if ("error" in parsed) return json({ error: parsed.error }, parsed.status);
  const online = forceLeave || parsed.leave ? await leave(parsed.id) : await heartbeat(parsed.id);
  return json({ online });
}

export async function GET(req: NextRequest) {
  const limited = await guard(req);
  if (limited) return limited;
  return json({ online: await countOnline() });
}

export function POST(req: NextRequest) {
  return handleWrite(req, false);
}

export function DELETE(req: NextRequest) {
  return handleWrite(req, true);
}
