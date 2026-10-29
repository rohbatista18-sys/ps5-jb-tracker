import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "./types";

// Latest PS5 14.10 jailbreak coverage from the Google News RSS search feed (the supported way to
// read Google News programmatically; no key, no scraping). Fetched server-side and cached, so
// visitors never contact Google. Titles and sources are untrusted text: rendered as plain text,
// and only https news.google.com article links are kept.

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string; // ISO
}

const QUERY = '"PS5" "14.10" jailbreak when:60d';
const FEED_LOCALE: Record<Locale, string> = {
  en: "hl=en-US&gl=US&ceid=US:en",
  es: "hl=es-419&gl=MX&ceid=MX:es-419",
  pt: "hl=pt-BR&gl=BR&ceid=BR:pt-419",
};
const MAX_ITEMS = 9;
const TIMEOUT_MS = 8000;

// Keep it on-topic and away from scam bait ("free jailbreak download" and the like).
const MUST_MATCH = [/14\.10/, /jailbreak|exploit|hack|desbloque|crack|kernel|firmware/i];
const REJECT_TITLE = /download|descarga|baixar|gr[aá]tis|gratis|free|telegram|discord|whatsapp|link in bio|tutorial|how to|c[oó]mo hacer|como fazer/i;
const REJECT_SOURCE = /youtube|tiktok|facebook|instagram|x\.com|twitter/i;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .trim();
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

function safeUrl(raw: string): string | null {
  try {
    const u = new URL(decode(raw));
    return u.protocol === "https:" && u.hostname === "news.google.com" ? u.toString() : null;
  } catch {
    return null;
  }
}

function parse(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = decode(tag(block, "source")).slice(0, 60);
    // Google appends " - <source>" to every title.
    let title = decode(tag(block, "title"));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    title = title.slice(0, 200);
    const url = safeUrl(tag(block, "link"));
    const date = new Date(decode(tag(block, "pubDate")));
    if (!title || !url || Number.isNaN(date.getTime())) continue;
    if (!MUST_MATCH.every((re) => re.test(title)) || REJECT_TITLE.test(title) || REJECT_SOURCE.test(source)) continue;
    const dedupe = title.toLowerCase().replace(/[^a-z0-9à-ú]+/g, " ").trim().slice(0, 60);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    items.push({ title, source: source || new URL(url).hostname, url, publishedAt: date.toISOString() });
  }
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_ITEMS);
}

/** Never throws: an empty list just hides the section's items. */
export async function getNews(locale: Locale): Promise<NewsItem[]> {
  "use cache";
  cacheTag("news", `news:${locale}`);
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&${FEED_LOCALE[locale]}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ps5-jb-tracker; +https://ps5-jb-tracker.vercel.app)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
      },
    );
    if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
    const items = parse(await res.text());
    cacheLife({ stale: 600, revalidate: 1800, expire: 86400 });
    return items;
  } catch (err) {
    console.error("[news] fetch failed:", err instanceof Error ? err.message : err);
    cacheLife({ stale: 60, revalidate: 120, expire: 300 });
    return [];
  }
}
