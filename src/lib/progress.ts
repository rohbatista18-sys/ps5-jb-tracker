import { STAGES, type RepoView, type Stage, type StageState } from "./types";

// One source for every progress number on the page (card and mobile switcher tiles), so they
// always match each other and are identical in every language.

const STATE_VALUE: Record<StageState, number> = { done: 1, partial: 0.5, none: 0 };

export function progressPercent(stages: Record<Stage, StageState>) {
  return Math.round(STAGES.reduce((sum, s) => sum + s.weight * STATE_VALUE[stages[s.id]], 0));
}

/** One block of the progress bar: an author's stage (name/status in their own words) or one of ours. */
export interface ProgressRow {
  state: StageState;
  weight: number; // flex-grow; author stages are equal, our AI stages use STAGES weights
  name?: string; // author's wording
  status?: string; // author's wording, e.g. "9/10", "CONFIRMED"
  stage?: Stage; // AI estimate: translated via the dictionary
}

export interface Progress {
  percent: number | null;
  source: "author" | "ai" | null;
  kind: "score" | "stages" | "ai" | null;
  done: number; // author's own figures (65 of 100, 5 of 8) for the caption
  total: number;
  partial: number;
  rows: ProgressRow[];
  next: ProgressRow | null; // first row not done yet
}

export function progressOf(repo: Pick<RepoView, "selfReport" | "summary">): Progress {
  const { selfReport } = repo;
  const aiStages = repo.summary.stages;
  const rows: ProgressRow[] = selfReport?.stages
    ? selfReport.stages.map((s) => ({ state: s.state, weight: 1, name: s.name, status: s.status }))
    : aiStages
      ? STAGES.map((s) => ({ state: aiStages[s.id], weight: s.weight, stage: s.id }))
      : [];
  const next = rows.find((r) => r.state !== "done") ?? null;

  if (selfReport) {
    const { percent, kind, done, total, partial } = selfReport;
    return { percent, source: "author", kind, done, total, partial, rows, next };
  }
  if (aiStages) {
    const done = rows.filter((r) => r.state === "done").length;
    const partial = rows.filter((r) => r.state === "partial").length;
    return { percent: progressPercent(aiStages), source: "ai", kind: "ai", done, total: rows.length, partial, rows, next };
  }
  return { percent: null, source: null, kind: null, done: 0, total: 0, partial: 0, rows, next: null };
}
