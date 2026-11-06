import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  adminConfigured,
  allowedLogins,
  createSessionValue,
  sameString,
  sessionCookieOptions,
} from "@/lib/admin-auth";
import { env } from "@/lib/env";

const TIMEOUT_MS = 8000;

const back = (req: NextRequest, error?: string) => {
  const res = NextResponse.redirect(new URL(error ? `/admin?error=${error}` : "/admin", req.url), 303);
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/admin" });
  res.headers.set("Cache-Control", "no-store");
  return res;
};

/** GitHub sends the visitor back here: check state, swap the code for a token, read the login. */
export async function GET(req: NextRequest) {
  if (!adminConfigured()) return back(req, "config");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? undefined;
  if (!code || !sameString(state, req.cookies.get(STATE_COOKIE)?.value)) return back(req, "state");

  let login: string | null = null;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.githubOAuthClientId,
        client_secret: env.githubOAuthClientSecret,
        code,
        redirect_uri: new URL("/api/admin/callback", req.url).href,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const token = ((await tokenRes.json()) as { access_token?: string }).access_token;
    if (token) {
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ps5-jb-tracker" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      const user = (await userRes.json()) as { login?: unknown };
      login = typeof user.login === "string" ? user.login : null;
    }
  } catch (err) {
    console.error("[admin] oauth failed:", err instanceof Error ? err.message : err);
    return back(req, "github");
  }

  if (!login) return back(req, "github");
  if (!allowedLogins().includes(login.toLowerCase())) {
    console.warn(`[admin] login refused for ${login}`);
    return back(req, "denied");
  }

  const res = back(req);
  res.cookies.set(SESSION_COOKIE, createSessionValue(login), sessionCookieOptions);
  return res;
}
