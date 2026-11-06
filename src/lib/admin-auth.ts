import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

// Admin login with GitHub OAuth. Only logins listed in ADMIN_GITHUB_LOGINS get a session.
// The session is a signed cookie (HMAC-SHA256 with ADMIN_SESSION_SECRET) holding the login and
// an expiry; the GitHub access token is used once to read the login and never stored.

export const SESSION_COOKIE = "admin_session";
export const STATE_COOKIE = "admin_oauth_state";
const SESSION_HOURS = 8;

export interface AdminSession {
  login: string;
  exp: number; // epoch seconds
}

/** Admin is only available when every piece of its configuration is present. */
export function adminConfigured(): boolean {
  return Boolean(
    env.githubOAuthClientId && env.githubOAuthClientSecret && (env.adminSessionSecret?.length ?? 0) >= 32 && allowedLogins().length,
  );
}

export function allowedLogins(): string[] {
  return (env.adminGithubLogins ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const sign = (data: string) => createHmac("sha256", env.adminSessionSecret!).update(data).digest("base64url");

export function createSessionValue(login: string): string {
  const payload: AdminSession = { login, exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionValue(value: string | undefined): AdminSession | null {
  if (!value || !adminConfigured()) return null;
  const [data, mac] = value.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as AdminSession;
    if (typeof s.login !== "string" || typeof s.exp !== "number") return null;
    if (s.exp < Date.now() / 1000) return null;
    // Removing a login from the allowlist ends its sessions right away.
    if (!allowedLogins().includes(s.login.toLowerCase())) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const, // lax: the cookie must survive the redirect back from github.com
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};

export const newState = () => randomBytes(24).toString("base64url");

export function sameString(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
