import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, adminConfigured, newState } from "@/lib/admin-auth";
import { env } from "@/lib/env";

/** Starts GitHub OAuth: a random state in a short-lived cookie, then off to github.com. */
export async function GET(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.redirect(new URL("/admin?error=config", req.url), 303);
  const state = newState();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.githubOAuthClientId!);
  authorize.searchParams.set("redirect_uri", new URL("/api/admin/callback", req.url).href);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  const res = NextResponse.redirect(authorize, 303);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/admin",
    maxAge: 600,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
