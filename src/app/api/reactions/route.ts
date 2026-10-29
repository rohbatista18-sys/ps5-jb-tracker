import { after, type NextRequest } from "next/server";
import { addReaction, getAllReactions, isRepoId, withBaseline } from "@/lib/reactions";
import { isReactionAllowed, isReactionKey } from "@/lib/reactions-config";
import { peekQuota, takeQuota } from "@/lib/reaction-quota";
import { rateLimit } from "@/lib/rate-limit";
import { broadcastSalve } from "@/lib/realtime";
import { blockUntilWindowEnd, clientIp, isForeignOrigin, locallyBlocked, readBody } from "@/lib/request";

const MAX_BODY_BYTES = 160;
const NONCE = /^[0-9a-f]{12}$/;
const WRITE_LIMIT_PER_MIN = 20; // anti-flood; the real per-person limit is the hourly quota
const READ_LIMIT_PER_MIN = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200, extra: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

async function limited(req: NextRequest, bucket: string, limit: number): Promise<Response | null> {
  const key = `reactions:${bucket}:${clientIp(req)}`;
  const tooMany = () => json({ error: "too many requests" }, 429, { "Retry-After": "60" });
  if (locallyBlocked(key)) return tooMany();
  const { ok } = await rateLimit(key, limit, 60);
  if (ok) return null;
  blockUntilWindowEnd(key, 60);
  return tooMany();
}

export async function GET(req: NextRequest) {
  const blocked = await limited(req, "read", READ_LIMIT_PER_MIN);
  if (blocked) return blocked;
  const [all, quota] = await Promise.all([getAllReactions(), peekQuota(clientIp(req))]);
  const counts = Object.fromEntries(Object.entries(all).map(([repo, c]) => [repo, withBaseline(c)]));
  return json({ counts, ...quota });
}

export async function POST(req: NextRequest) {
  if (isForeignOrigin(req)) return json({ error: "forbidden" }, 403);
  const blocked = await limited(req, "write", WRITE_LIMIT_PER_MIN);
  if (blocked) return blocked;

  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: "payload too large" }, 413);
  let data: { repo?: unknown; reaction?: unknown; n?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!isRepoId(data?.repo) || !isReactionKey(data?.reaction) || !isReactionAllowed(data.repo, data.reaction)) {
    return json({ error: "invalid reaction" }, 400);
  }

  const quota = await takeQuota(clientIp(req));
  if (!quota.ok) {
    const retry = Math.max(1, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000));
    return json({ error: "quota", remaining: 0, resetAt: quota.resetAt }, 429, { "Retry-After": String(retry) });
  }
  const counts = withBaseline(await addReaction(data.repo, data.reaction));
  const salve = { repo: data.repo, reaction: data.reaction, n: typeof data.n === "string" && NONCE.test(data.n) ? data.n : "" };
  after(() => broadcastSalve(salve));
  return json({ repo: data.repo, counts, remaining: quota.remaining, resetAt: quota.resetAt });
}
