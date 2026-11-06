import "server-only";
import { createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { env } from "./env";

// Admin login with a username and password. The passwords never reach the code or the repo:
// ADMIN_USERS holds "name:salt:hash" entries (scrypt, made with scripts/admin-password.mjs),
// comma-separated. A login gets a signed cookie (HMAC-SHA256 with ADMIN_SESSION_SECRET) holding
// the username and an expiry.

export const SESSION_COOKIE = "admin_session";
const SESSION_HOURS = 8;
const KEY_LEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: typeof SCRYPT) => Promise<Buffer>;

export interface AdminSession {
  login: string;
  exp: number; // epoch seconds
}

interface AdminUser {
  name: string;
  salt: Buffer;
  hash: Buffer;
}

function users(): AdminUser[] {
  return (env.adminUsers ?? "")
    .split(",")
    .map((entry) => entry.trim().split(":"))
    .filter((p) => p.length === 3 && p[0] && p[1] && p[2])
    .map(([name, salt, hash]) => ({ name, salt: Buffer.from(salt, "base64url"), hash: Buffer.from(hash, "base64url") }))
    .filter((u) => u.salt.length >= 16 && u.hash.length === KEY_LEN);
}

const findUser = (name: string) => users().find((u) => u.name.toLowerCase() === name.trim().toLowerCase());

/** Admin is only available when users and the session secret are configured. */
export function adminConfigured(): boolean {
  return (env.adminSessionSecret?.length ?? 0) >= 32 && users().length > 0;
}

// Compared against when the username does not exist, so a wrong user costs the same time.
const DUMMY: AdminUser = { name: "", salt: Buffer.alloc(16, 1), hash: Buffer.alloc(KEY_LEN) };

/** The canonical username when the password matches, else null. Always runs one scrypt. */
export async function checkPassword(name: string, password: string): Promise<string | null> {
  const user = findUser(name);
  const target = user ?? DUMMY;
  const got = await scryptAsync(password, target.salt, KEY_LEN, SCRYPT);
  return user && timingSafeEqual(got, target.hash) ? user.name : null;
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
    // Removing a user from ADMIN_USERS ends their sessions right away.
    if (!findUser(s.login)) return null;
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
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};
