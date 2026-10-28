import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  hasLocale,
  localeFromAcceptLanguage,
  localeFromCountry,
} from "@/i18n/config";

// Manual choice (cookie) → visitor country (Vercel geo header) → browser language → English.
function detectLocale(request: NextRequest) {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && hasLocale(cookie)) return cookie;
  return (
    localeFromCountry(request.headers.get("x-vercel-ip-country")) ??
    localeFromAcceptLanguage(request.headers.get("accept-language")) ??
    DEFAULT_LOCALE
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${detectLocale(request)}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Vary", "Cookie, Accept-Language, X-Vercel-IP-Country");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
