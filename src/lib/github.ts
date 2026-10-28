import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CommitInfo, RepoConfig, RepoSnapshot } from "./types";

const API = "https://api.github.com";
const README_MAX = 12000;
const TIMEOUT_MS = 8000;

class GitHubError extends Error {}

function headers(accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = {
    Accept: accept,
    "User-Agent": "ps5-jb-tracker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh(path: string, accept?: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    headers: headers(accept),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return res;
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 429 || (res.status === 403 && remaining === "0")) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? ` (reset ${new Date(reset * 1000).toISOString()})` : "";
    throw new GitHubError(`GitHub rate limit exceeded${when}`);
  }
  throw new GitHubError(`GitHub ${res.status} on ${path}`);
}

interface ApiRepo {
  description: string | null;
  stargazers_count: number;
  pushed_at: string | null;
}

interface ApiCommit {
  sha: string;
  commit: { message: string; committer: { date: string } | null; author: { date: string } | null };
}

const COMMIT_MESSAGE_MAX = 300;
const SHA = /^[0-9a-f]{40}$/;

// Links are built from the static repo config, never taken from API payloads.
const repoUrl = (config: RepoConfig) => `https://github.com/${config.owner}/${config.repo}`;

const toCommit = (config: RepoConfig) => (c: ApiCommit): CommitInfo => ({
  sha: c.sha,
  message: c.commit.message.split("\n", 1)[0].trim().slice(0, COMMIT_MESSAGE_MAX),
  date: c.commit.committer?.date ?? c.commit.author?.date ?? "",
  url: `${repoUrl(config)}/commit/${c.sha}`,
});

async function fetchReadme(base: string): Promise<string | null> {
  try {
    const text = await (await gh(`${base}/readme`, "application/vnd.github.raw")).text();
    return text.length > README_MAX ? text.slice(0, README_MAX) : text;
  } catch (e) {
    if (e instanceof GitHubError && e.message.startsWith("GitHub 404")) return null;
    throw e;
  }
}

function describe(e: unknown): string {
  if (e instanceof GitHubError) return e.message;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return `GitHub request timed out after ${TIMEOUT_MS / 1000}s`;
  }
  return `GitHub fetch failed: ${e instanceof Error ? e.message : String(e)}`;
}

export async function getRepoSnapshot(config: RepoConfig): Promise<RepoSnapshot> {
  "use cache";
  cacheTag("github", `github:${config.id}`);

  const base = `/repos/${config.owner}/${config.repo}`;
  try {
    const [repo, commits, readme] = await Promise.all([
      gh(base).then((r) => r.json() as Promise<ApiRepo>),
      gh(`${base}/commits?per_page=5`).then((r) => r.json() as Promise<ApiCommit[]>),
      fetchReadme(base),
    ]);
    const recentCommits = commits
      .filter((c) => SHA.test(c.sha))
      .slice(0, 5)
      .map(toCommit(config));
    cacheLife({ stale: 300, revalidate: 600, expire: 86400 });
    return {
      config,
      htmlUrl: repoUrl(config),
      description: repo.description,
      stars: repo.stargazers_count,
      pushedAt: repo.pushed_at,
      lastCommit: recentCommits[0] ?? null,
      recentCommits,
      readme,
    };
  } catch (e) {
    // Keep failures short-lived so a transient error doesn't stick for 10 min.
    cacheLife({ stale: 60, revalidate: 60, expire: 300 });
    return {
      config,
      htmlUrl: repoUrl(config),
      description: null,
      stars: 0,
      pushedAt: null,
      lastCommit: null,
      recentCommits: [],
      readme: null,
      error: describe(e),
    };
  }
}
