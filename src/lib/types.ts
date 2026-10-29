// Shared contracts. Read-only for feature work — change only with Tech Lead agreement.

export interface DonationLink {
  label: string; // "Ko-fi", "PayPal", "BTC", "X"
  url?: string; // absent for crypto addresses
  value?: string; // e.g. BTC address shown with a copy button
}

export interface RepoConfig {
  id: "zig" | "pasta" | "kuzi" | "zeco";
  nickname: string; // same as the GitHub username
  owner: string;
  repo: string;
  gistId?: string; // when set, fetches from the Gist API instead of the Repos API
  x: string; // X/Twitter handle, without "@"
  youtube?: string; // YouTube channel handle or path segment, without "@"
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

export interface RepoView extends RepoSnapshot {
  summary: RepoSummary;
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
