import "server-only";
import type { NextRequest } from "next/server";

// IPv6 clients usually own a whole /64, so limit per /64 instead of per address.
function ipv6Prefix(ip: string): string {
  const [head, tail = ""] = ip.toLowerCase().split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

// Used only as rate-limit input; rate-limit.ts stores a keyed, per-window hash, never the IP.
export function clientIp(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  if (!ip) return "unknown";
  return ip.includes(":") && !ip.startsWith("::ffff:") ? ipv6Prefix(ip) : ip;
}

// Browsers always send Origin on cross-site POST/DELETE (including sendBeacon);
// rejecting foreign origins stops other sites from driving writes via their visitors.
export function isForeignOrigin(req: NextRequest): boolean {
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

/** Reads the body with a hard byte cap; null when it is too large. */
export async function readBody(req: NextRequest, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Per-instance short-circuit so a flooding client stops costing Redis commands once limited.
// Holds the bucket key only until the window ends; swept on every check.
const blockedUntil = new Map<string, number>();

export function locallyBlocked(key: string, now = Date.now()): boolean {
  for (const [k, until] of blockedUntil) if (until <= now) blockedUntil.delete(k);
  return blockedUntil.has(key);
}

export function blockUntilWindowEnd(key: string, windowSec: number, now = Date.now()) {
  const ms = windowSec * 1000;
  if (blockedUntil.size < 10_000) blockedUntil.set(key, (Math.floor(now / ms) + 1) * ms);
}
