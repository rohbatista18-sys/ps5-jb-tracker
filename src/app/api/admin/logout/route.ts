import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin-auth";

/** POST only (a form button), so a link elsewhere cannot log the admin out. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
