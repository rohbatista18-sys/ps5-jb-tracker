import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getRepoSnapshot } from "./github";
import { parseSelfReport } from "./self-report";
import { getSiteConfig } from "./site-config";
import { getXPosts } from "./x-posts";
import { summarizeOverall, summarizeRepo } from "./summarize";
import type { DashboardData, RepoView } from "./types";

export async function getDashboard(): Promise<DashboardData> {
  "use cache";
  cacheTag("github", "dashboard", "config");

  const { researchers } = await getSiteConfig();
  const [snapshots, xPosts] = await Promise.all([
    Promise.all(researchers.map((c) => getRepoSnapshot(c))),
    Promise.all(researchers.map((c) => (c.x ? getXPosts(c.x) : null))),
  ]);
  const repos: RepoView[] = await Promise.all(
    // The README is only needed for the prompt; keep it out of the cached dashboard and page props.
    snapshots.map(async (s, i) => ({
      ...s,
      readme: null,
      selfReport: parseSelfReport(s.readme),
      xPosts: xPosts[i],
      summary: await summarizeRepo(s),
    })),
  );
  const overall = await summarizeOverall(repos);

  const degraded = repos.some((r) => r.error || r.summary.fallback) || overall.fallback;
  cacheLife(degraded ? { stale: 60, revalidate: 60, expire: 300 } : { stale: 300, revalidate: 600, expire: 86400 });

  return { repos, overall, fetchedAt: new Date().toISOString() };
}
