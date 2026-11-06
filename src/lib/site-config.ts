import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getDictionary } from "@/i18n/dictionaries";
import { REPOS } from "./repos";
import { hasSupabase, kvGet, kvSet } from "./supabase";
import { LOCALES, type DonationLink, type Localized, type RepoConfig } from "./types";

// Everything the admin page can change. Stored as one JSON document in the Supabase kv table;
// when nothing is stored (or the store is down) the site runs on the defaults below, which are
// the values that used to be hard-coded.

export interface SiteConfig {
  researchers: RepoConfig[];
  notices: {
    guide: { enabled: boolean; url: string; text: Localized; link: Localized };
    banner: { enabled: boolean; title: Localized; subtitle: Localized };
  };
}

export interface AuditEntry {
  at: string; // ISO
  by: string; // GitHub login
  section: string;
  summary: string;
}

const CONFIG_KEY = "config:v1";
const AUDIT_KEY = "config:audit:v1";
const AUDIT_MAX = 100;

const localized = (fn: (d: ReturnType<typeof getDictionary>) => string) =>
  Object.fromEntries(LOCALES.map((l) => [l, fn(getDictionary(l))])) as Localized;

export const DEFAULT_CONFIG: SiteConfig = {
  researchers: REPOS,
  notices: {
    guide: {
      enabled: true,
      url: "https://ps5-jb-guide.vercel.app/",
      text: localized((d) => d.guide.text),
      link: localized((d) => d.guide.link),
    },
    banner: {
      enabled: true,
      title: localized((d) => d.bigNotice.title),
      subtitle: localized((d) => d.bigNotice.subtitle),
    },
  },
};

// ---------- validation (the admin form is the only writer, but never trust a request body) ----------

export class ConfigError extends Error {}

const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const DEV_ID = /^[a-z0-9-]{2,20}$/;
const CRYPTO_VALUE = /^[A-Za-z0-9]{10,120}$/;
const MAX_DEVS = 8;
const MAX_DONATIONS = 6;

const str = (v: unknown, field: string, max: number, required = true): string => {
  const s = typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, "").trim() : "";
  if (required && !s) throw new ConfigError(`${field}: required`);
  if (s.length > max) throw new ConfigError(`${field}: at most ${max} characters`);
  return s;
};

const httpsUrl = (v: unknown, field: string): string => {
  const s = str(v, field, 300);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new ConfigError(`${field}: not a valid URL`);
  }
  if (u.protocol !== "https:" || u.username || u.password) throw new ConfigError(`${field}: must be an https:// link`);
  return u.href;
};

const loc = (v: unknown, field: string, max: number): Localized => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(LOCALES.map((l) => [l, str(o[l], `${field} (${l})`, max)])) as Localized;
};

function donation(v: unknown, field: string): DonationLink {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const label = str(o.label, `${field} label`, 20);
  const url = typeof o.url === "string" && o.url.trim() ? httpsUrl(o.url, `${field} link`) : undefined;
  const value = typeof o.value === "string" && o.value.trim() ? str(o.value, `${field} address`, 120) : undefined;
  if (!url === !value) throw new ConfigError(`${field}: give either a link or an address`);
  if (value && !CRYPTO_VALUE.test(value)) throw new ConfigError(`${field}: address has invalid characters`);
  return url ? { label, url } : { label, value };
}

export function validateResearchers(v: unknown): RepoConfig[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_DEVS) throw new ConfigError(`researchers: 1 to ${MAX_DEVS}`);
  const ids = new Set<string>();
  return v.map((raw, i) => {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const f = `researcher ${i + 1}`;
    const id = str(o.id, `${f} id`, 20);
    if (!DEV_ID.test(id)) throw new ConfigError(`${f} id: lowercase letters, numbers and "-"`);
    if (ids.has(id)) throw new ConfigError(`${f} id: duplicated`);
    ids.add(id);
    const nickname = str(o.nickname, `${f} name`, 39);
    const owner = str(o.owner, `${f} GitHub owner`, 39);
    if (!GITHUB_NAME.test(nickname) || !GITHUB_NAME.test(owner)) throw new ConfigError(`${f}: name/owner must be GitHub usernames`);
    const repo = str(o.repo, `${f} repository`, 100);
    if (!REPO_NAME.test(repo)) throw new ConfigError(`${f} repository: invalid name`);
    const x = str(o.x, `${f} X handle`, 15, false).replace(/^@/, "");
    if (x && !X_HANDLE.test(x)) throw new ConfigError(`${f} X handle: invalid`);
    const donationsRaw = Array.isArray(o.donations) ? o.donations : [];
    if (donationsRaw.length > MAX_DONATIONS) throw new ConfigError(`${f}: at most ${MAX_DONATIONS} donation links`);
    const donations = donationsRaw.map((d, j) => donation(d, `${f} donation ${j + 1}`));
    const donationNote = str(o.donationNote, `${f} note`, 120, false);
    return { id, nickname, owner, repo, ...(x ? { x } : {}), donations, ...(donationNote ? { donationNote } : {}) };
  });
}

export function validateNotices(v: unknown): SiteConfig["notices"] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown>>;
  const g = o.guide ?? {};
  const b = o.banner ?? {};
  return {
    guide: {
      enabled: g.enabled === true,
      url: httpsUrl(g.url, "guide link"),
      text: loc(g.text, "guide text", 200),
      link: loc(g.link, "guide link text", 40),
    },
    banner: {
      enabled: b.enabled === true,
      title: loc(b.title, "banner title", 60),
      subtitle: loc(b.subtitle, "banner subtitle", 60),
    },
  };
}

// ---------- store ----------

// Without Supabase (local tests) changes live in memory only, so nothing reaches production.
let memoryConfig: SiteConfig | null = null;
let memoryAudit: AuditEntry[] = [];

async function readStored(): Promise<Partial<SiteConfig> | null> {
  if (!hasSupabase()) return memoryConfig;
  return kvGet<Partial<SiteConfig>>(CONFIG_KEY);
}

/** Stored config merged over the defaults; a broken section falls back to its default. */
export async function loadSiteConfig(): Promise<SiteConfig> {
  let stored: Partial<SiteConfig> | null = null;
  try {
    stored = await readStored();
  } catch (err) {
    console.error("[config] read failed:", err instanceof Error ? err.message : err);
  }
  const safe = <T>(fn: () => T, fallback: T) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    researchers: stored?.researchers ? safe(() => validateResearchers(stored.researchers), DEFAULT_CONFIG.researchers) : DEFAULT_CONFIG.researchers,
    notices: stored?.notices ? safe(() => validateNotices(stored.notices), DEFAULT_CONFIG.notices) : DEFAULT_CONFIG.notices,
  };
}

/** Cached for the public pages; the admin save calls revalidateTag("config"). */
export async function getSiteConfig(): Promise<SiteConfig> {
  "use cache";
  cacheTag("config");
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
  return loadSiteConfig();
}

export async function saveSiteConfig(next: SiteConfig, entry: AuditEntry): Promise<void> {
  if (!hasSupabase()) {
    memoryConfig = next;
    memoryAudit = [entry, ...memoryAudit].slice(0, AUDIT_MAX);
    return;
  }
  await kvSet(CONFIG_KEY, next);
  const audit = (await kvGet<AuditEntry[]>(AUDIT_KEY).catch(() => null)) ?? [];
  await kvSet(AUDIT_KEY, [entry, ...audit].slice(0, AUDIT_MAX));
}

export async function getAudit(): Promise<AuditEntry[]> {
  if (!hasSupabase()) return memoryAudit;
  try {
    return (await kvGet<AuditEntry[]>(AUDIT_KEY)) ?? [];
  } catch {
    return [];
  }
}
