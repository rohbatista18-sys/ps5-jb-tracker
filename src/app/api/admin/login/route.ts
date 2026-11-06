import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, adminConfigured, checkPassword, createSessionValue, sessionCookieOptions } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, isForeignOrigin } from "@/lib/request";

// Brute-force brakes: per visitor and per username, on top of scrypt's cost per attempt.
const PER_IP = 10;
const PER_USER = 5;
const WINDOW_SEC = 15 * 60;
const MAX_FIELD = 200;

const back = (req: NextRequest, error?: string) => {
  const res = NextResponse.redirect(new URL(error ? `/admin?error=${error}` : "/admin", req.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
};

/** Login form POST: user + password → signed session cookie. Errors never say which part failed. */
export async function POST(req: NextRequest) {
  if (isForeignOrigin(req)) return back(req, "login");
  if (!adminConfigured()) return back(req, "config");
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return back(req, "login");

  let user = "";
  let password = "";
  try {
    const form = await req.formData();
    user = String(form.get("user") ?? "").slice(0, MAX_FIELD);
    password = String(form.get("password") ?? "").slice(0, MAX_FIELD);
  } catch {
    return back(req, "login");
  }
  if (!user || !password) return back(req, "login");

  const [byIp, byUser] = await Promise.all([
    rateLimit(`admin-login:ip:${clientIp(req)}`, PER_IP, WINDOW_SEC),
    rateLimit(`admin-login:user:${user.toLowerCase()}`, PER_USER, WINDOW_SEC),
  ]);
  if (!byIp.ok || !byUser.ok) return back(req, "wait");

  const login = await checkPassword(user, password);
  if (!login) {
    console.warn("[admin] failed login");
    return back(req, "login");
  }

  const res = back(req);
  res.cookies.set(SESSION_COOKIE, createSessionValue(login), sessionCookieOptions);
  return res;
}
