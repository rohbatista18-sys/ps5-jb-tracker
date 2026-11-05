import type { AuthorStage, SelfReport, StageState } from "./types";

// The progress each researcher publishes in their own README: their stage/milestone table, plus a
// "NN/100" score when they give one (otherwise the share of confirmed rows). The README is untrusted,
// so cells are reduced to short plain text (React escapes it) and only numbers drive the bar.

const TABLE_HEAD = /^\s*\|\s*(stage|milestone|component|step|phase)\s*\|/i;
const SCORE_LINE = /progress|estimate|score|milestone/i;
const SCORE = /\b(\d{1,3})\s*\/\s*100\b/;
const POINTS = /^(\d{1,3})\s*\/\s*(\d{1,3})$/;
const NOT_DONE = /\bnot\b|\bno\b|blocked|dead|planned|next|todo|pending|unknown/i;
const DONE = /\b(confirmed|done|complete[d]?|working|demonstrated|achieved)\b|✅/i;
// "DESIGNED" = worked out but not demonstrated yet: partial, worth half a stage in the %. Code that
// merely exists ("Defined in source", "Present in source") is not progress, so it stays "none".
const PARTIAL = /\b(partial|designed|in progress|wip|ongoing)\b/i;
const MAX_ROWS = 12;
const CELL_MAX = 80;

const cell = (s: string) => {
  const t = s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*+|`+|~~|[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > CELL_MAX ? `${t.slice(0, CELL_MAX - 1).trimEnd()}…` : t;
};

function stateOf(status: string): StageState {
  const points = status.match(POINTS);
  if (points) {
    const [earned, weight] = [Number(points[1]), Number(points[2])];
    return earned >= weight && weight > 0 ? "done" : earned > 0 ? "partial" : "none";
  }
  if (NOT_DONE.test(status)) return "none";
  if (DONE.test(status)) return "done";
  return PARTIAL.test(status) ? "partial" : "none";
}

function stageTable(readme: string): AuthorStage[] | null {
  const lines = readme.split("\n");
  const head = lines.findIndex((l) => TABLE_HEAD.test(l));
  if (head < 0) return null;
  const stages: AuthorStage[] = [];
  for (const l of lines.slice(head + 2)) {
    if (!l.trim().startsWith("|")) break;
    const [, name = "", status = ""] = l.split("|").map(cell);
    if (name && status) stages.push({ name, status, state: stateOf(status) });
  }
  return stages.length >= 2 ? stages.slice(0, MAX_ROWS) : null;
}

function score(readme: string): number | null {
  for (const line of readme.split("\n")) {
    if (!SCORE_LINE.test(line)) continue;
    const n = Number(line.match(SCORE)?.[1] ?? NaN);
    if (n >= 0 && n <= 100) return n;
  }
  return null;
}

export function parseSelfReport(readme: string | null): SelfReport | null {
  if (!readme) return null;
  const stages = stageTable(readme);
  const points = score(readme);
  const partial = stages?.filter((s) => s.state === "partial").length ?? 0;
  if (points !== null) return { percent: points, kind: "score", done: points, total: 100, partial: 0, stages };
  if (!stages) return null;
  const done = stages.filter((s) => s.state === "done").length;
  // Same weighting as the AI estimate: a partial stage counts half.
  const percent = Math.round(((done + partial / 2) / stages.length) * 100);
  return { percent, kind: "stages", done, total: stages.length, partial, stages };
}
