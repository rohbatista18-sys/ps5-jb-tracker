"use server";

import { updateTag } from "next/cache";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ConfigError,
  loadSiteConfig,
  saveSiteConfig,
  validateNotices,
  validateResearchers,
  type SiteConfig,
} from "@/lib/site-config";

export type SaveResult = { ok: true; at: string } | { ok: false; error: string };

// Every action re-checks the session: server actions are plain POST endpoints.
async function save(section: keyof SiteConfig, value: unknown, summary: (v: never) => string): Promise<SaveResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "session" };
  try {
    const current = await loadSiteConfig();
    const next: SiteConfig =
      section === "researchers"
        ? { ...current, researchers: validateResearchers(value) }
        : { ...current, notices: validateNotices(value) };
    const at = new Date().toISOString();
    await saveSiteConfig(next, { at, by: session.login, section, summary: summary(next[section] as never) });
    // Public pages: config, plus the dashboard (it embeds the researcher list).
    updateTag("config");
    updateTag("dashboard");
    return { ok: true, at };
  } catch (err) {
    if (err instanceof ConfigError) return { ok: false, error: err.message };
    console.error("[admin] save failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "store" };
  }
}

export async function saveResearchers(value: unknown): Promise<SaveResult> {
  return save("researchers", value, (r: SiteConfig["researchers"]) => r.map((d) => d.nickname).join(", "));
}

export async function saveNotices(value: unknown): Promise<SaveResult> {
  return save("notices", value, (n: SiteConfig["notices"]) =>
    `guide ${n.guide.enabled ? "on" : "off"}, banner ${n.banner.enabled ? "on" : "off"}`,
  );
}
