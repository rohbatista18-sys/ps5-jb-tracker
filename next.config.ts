import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Receive-only live salves (Supabase Realtime); only this project's host is allowed.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9-]+\.supabase\.co)\/?$/)?.[1];
const realtimeHosts = supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : "";

// 'unsafe-inline' for scripts: Cache Components / partial prerendering serves a static
// shell, which is incompatible with per-request nonces. Risk is mitigated by never
// rendering untrusted content as HTML (AI and repo text are rendered as plain text).
// Hashes aren't viable either: the inline `self.__next_f.push(...)` scripts carry the RSC
// payload (summaries, commit messages), so they change on every data refresh, and
// `experimental.sri` only covers external chunks.
// Google AdSense: the loader script plus the hosts it pulls ads, frames and pings from.
const adsHosts =
  " https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net" +
  " https://*.google.com https://*.adtrafficquality.google https://*.gstatic.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${adsHosts}`,
  // React never emits inline event-handler attributes, so block them outright.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self'${realtimeHosts}${adsHosts}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  `frame-src${adsHosts}`,
  "worker-src 'none'",
  "media-src 'none'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nothing (not even the origin) is sent to external sites; same-origin requests keep it,
  // so `sendBeacon`'s Origin header still passes the presence API's same-origin check.
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer", "autoplay", "bluetooth", "browsing-topics", "camera", "display-capture",
      "geolocation", "gyroscope", "hid", "idle-detection", "magnetometer", "microphone", "midi",
      "payment", "publickey-credentials-get", "serial", "usb", "xr-spatial-tracking",
    ].map((f) => `${f}=()`).join(", "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Baked into both the server and client bundles, so open tabs can tell a new deploy went live.
  env: { BUILD_ID: process.env.VERCEL_DEPLOYMENT_ID ?? `local-${Date.now()}` },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
