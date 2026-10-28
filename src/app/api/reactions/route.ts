import type { NextRequest } from "next/server";
import { addReaction, getAllReactions, isRepoId } from "@/lib/reactions";
import { isReactionKey } from "@/lib/reactions-config";
import { rateLimit } from "@/lib/rate-limit";
import { blockUntilWindowEnd, clientIp, isForeignOrigin, locallyBlocked, readBody } from "@/lib/request";

const MAX_BODY_BYTES = 120;
const WRITE_LIMIT_PER_MIN = 20; // generous for real cheering, cuts off scripted spam
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
  return json(await getAllReactions());
}

export async function POST(req: NextRequest) {
  if (isForeignOrigin(req)) return json({ error: "forbidden" }, 403);
  const blocked = await limited(req, "write", WRITE_LIMIT_PER_MIN);
  if (blocked) return blocked;

  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: "payload too large" }, 413);
  let data: { repo?: unknown; reaction?: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!isRepoId(data?.repo) || !isReactionKey(data?.reaction)) return json({ error: "invalid reaction" }, 400);
  return json({ repo: data.repo, counts: await addReaction(data.repo, data.reaction) });
}
