// Shared contracts. Read-only for feature work — change only with Tech Lead agreement.

export interface DonationLink {
  label: string; // "Ko-fi", "PayPal", "BTC", "X"
  url?: string; // absent for crypto addresses
  value?: string; // e.g. BTC address shown with a copy button
}

export interface RepoConfig {
  id: "zig" | "pasta" | "kuzi" | "oniz";
  nickname: string; // same as the GitHub username
  owner: string;
  repo: string;
  x?: string; // X/Twitter handle, without "@" (absent when the researcher has none we know of)
  donations: DonationLink[];
  donationNote?: string;
}

export interface CommitInfo {
  sha: string;
  message: string; // first line only
  date: string; // ISO 8601
  url: string;
}

export interface RepoSnapshot {
  config: RepoConfig;
  htmlUrl: string;
  description: string | null;
  stars: number;
  pushedAt: string | null; // ISO
  lastCommit: CommitInfo | null;
  recentCommits: CommitInfo[]; // newest first, max 5
  readme: string | null; // raw markdown, may be truncated
  error?: string; // set when GitHub fetch failed
}

export const LOCALES = ["en", "es", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export type Localized = Record<Locale, string>;

// Stages of a full jailbreak chain; weights sum to 100 and drive the progress bar.
export const STAGES = [
  { id: "entry", weight: 15 },
  { id: "userlandRw", weight: 15 },
  { id: "kaslr", weight: 15 },
  { id: "kernelRw", weight: 25 },
  { id: "privesc", weight: 20 },
  { id: "release", weight: 10 },
] as const;
export type Stage = (typeof STAGES)[number]["id"];
export type StageState = "done" | "partial" | "none";

export interface RepoSummary {
  text: Localized; // 2–4 sentences per locale, plain text
  stages?: Record<Stage, StageState>; // absent when the AI was unavailable
  status: "early" | "progressing" | "breakthrough" | "stalled" | "unknown";
  generatedAt: string; // ISO
  sourceSha: string | null;
  fallback?: boolean; // true when the AI was unavailable
}

// One row of the stage/milestone table a researcher publishes, copied as plain text.
export interface AuthorStage {
  name: string;
  status: string; // the author's own wording, e.g. "CONFIRMED", "9/10", "Not established"
  state: StageState; // drives the colour only
}

// Progress the researcher publishes in their own README (see lib/self-report.ts).
export interface SelfReport {
  percent: number; // 0–100
  kind: "score" | "stages"; // "65/100" score, or confirmed rows out of their stage table
  done: number;
  total: number;
  partial: number; // stages in progress (count half in the %)
  stages: AuthorStage[] | null;
}

// A recent post from the researcher's X profile (lib/x-posts.ts), as plain text.
export interface XPost {
  id: string;
  url: string; // built from validated author + id
  text: string;
  date: string; // ISO
  kind: "post" | "reply" | "repost";
  author: string; // original author; differs from the profile for reposts
}

export interface XPosts {
  posts: XPost[];
  fetchedAt: string; // when this list was last fetched successfully
  stale?: boolean; // true when the live fetch failed and this is the stored list
}

export interface RepoView extends RepoSnapshot {
  summary: RepoSummary;
  selfReport: SelfReport | null;
  xPosts: XPosts | null;
}

export interface DashboardData {
  repos: RepoView[];
  overall: { text: Localized; generatedAt: string; fallback?: boolean };
  fetchedAt: string; // ISO
}

export interface PresenceResponse {
  online: number;
  visits: number; // all-time page views (baseline + one per page load; no identifier stored)
  build?: string;
}
