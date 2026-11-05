import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getRedis } from "./redis";
import { hasSupabase, kvGet, kvSet } from "./supabase";
import type { XPost, XPosts } from "./types";

// Recent posts of a researcher's X profile, read server-side through FxTwitter's public API (no X
// key or login; visitors never contact X). FxTwitter often answers 404 for profiles that exist, so
// each fetch is retried and the last good list is kept in the shared store to cover the gaps.

const API = "https://api.fxtwitter.com/2/profile";
const TIMEOUT_MS = 6000;
const ATTEMPTS = 3;
const MAX_POSTS = 5;
const TEXT_MAX = 400;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const ID = /^\d{1,25}$/;
const lastGoodKey = (handle: string) => `x:posts:v1:${handle.toLowerCase()}`;

interface ApiStatus {
  id?: unknown;
  text?: unknown;
  created_timestamp?: unknown;
  replying_to?: unknown;
  reposted_by?: unknown;
  author?: { screen_name?: unknown };
}

// Post text is untrusted: plain text only (React escapes it), control characters removed, capped.
const plain = (s: string) => {
  const t = s.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? "\n" : " ")).replace(/\n{3,}/g, "\n\n").trim();
  return t.length > TEXT_MAX ? `${t.slice(0, TEXT_MAX - 1).trimEnd()}…` : t;
};

function toPost(s: ApiStatus): XPost | null {
  const id = typeof s.id === "string" && ID.test(s.id) ? s.id : null;
  const author = typeof s.author?.screen_name === "string" && HANDLE.test(s.author.screen_name) ? s.author.screen_name : null;
  const ts = typeof s.created_timestamp === "number" ? s.created_timestamp : NaN;
  if (!id || !author || !Number.isFinite(ts) || typeof s.text !== "string") return null;
  return {
    id,
    // Built from validated parts, never taken from the payload.
    url: `https://x.com/${author}/status/${id}`,
    text: plain(s.text),
    date: new Date(ts * 1000).toISOString(),
    kind: s.reposted_by ? "repost" : s.replying_to ? "reply" : "post",
    author,
  };
}

async function fetchOnce(handle: string): Promise<XPost[] | null> {
  const res = await fetch(`${API}/${handle}/statuses`, {
    headers: { Accept: "application/json", "User-Agent": "ps5-jb-tracker" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    redirect: "error",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { code?: number; results?: ApiStatus[] };
  if (body.code !== 200 || !Array.isArray(body.results)) return null;
  return body.results.map(toPost).filter((p): p is XPost => p !== null).slice(0, MAX_POSTS);
}

async function fetchLive(handle: string): Promise<XPost[] | null> {
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const posts = await fetchOnce(handle);
      if (posts?.length) return posts;
    } catch {
      // timeout or network error: try again
    }
  }
  return null;
}

async function readStored(key: string): Promise<XPosts | null> {
  if (hasSupabase()) {
    try {
      const v = await kvGet<XPosts>(key);
      if (v) return v;
    } catch {}
  }
  try {
    return (await getRedis()?.get<XPosts>(key)) ?? null;
  } catch {
    return null;
  }
}

async function writeStored(key: string, value: XPosts) {
  if (hasSupabase()) {
    try {
      return await kvSet(key, value);
    } catch {}
  }
  try {
    await getRedis()?.set(key, value);
  } catch {}
}

export async function getXPosts(handle: string): Promise<XPosts | null> {
  "use cache";
  cacheTag("x", `x:${handle}`);
  if (!HANDLE.test(handle)) return null;

  const key = lastGoodKey(handle);
  const posts = await fetchLive(handle);
  if (posts) {
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    const fresh = { posts, fetchedAt: new Date().toISOString() };
    await writeStored(key, fresh);
    return fresh;
  }
  // Failed: retry soon, and meanwhile show the last list that worked.
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  const stored = await readStored(key);
  return stored ? { ...stored, stale: true } : null;
}
