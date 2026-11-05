import type { Progress, ProgressRow } from "@/lib/progress";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import styles from "./ProgressBar.module.css";

interface Props {
  progress: Progress;
  dict: Dictionary["progress"];
}

const rowName = (r: ProgressRow, dict: Dictionary["progress"]) => r.name ?? (r.stage ? dict.stages[r.stage] : "");
const rowStatus = (r: ProgressRow, dict: Dictionary["progress"]) => r.status ?? dict.states[r.state];

/** Big number + source chip + one block per stage + the next stage. The full list lives in StageList. */
export default function ProgressBar({ progress, dict }: Props) {
  const { percent, source, kind, rows, next } = progress;
  const value = percent === null ? "?" : source === "ai" ? `~${percent}%` : `${percent}%`;
  const caption =
    source === "author"
      ? fill(kind === "score" ? dict.authorScore : progress.partial ? dict.authorStagesPartial : dict.authorStages, {
          done: progress.done,
          total: progress.total,
          partial: progress.partial,
        })
      : source === "ai"
        ? dict.noteAiShort
        : dict.unknown;
  const nextText = next
    ? fill(dict.next, { stage: rowName(next, dict) })
    : rows.length > 0 && source === "author"
      ? dict.allDone
      : null;

  return (
    <section className={styles.progress} aria-label={dict.title} data-source={source ?? "none"}>
      <div className={styles.hero}>
        <span className={styles.pct}>{value}</span>
        {source && (
          <span className={styles.tag} data-source={source}>
            {source === "author" ? dict.sourceAuthor : dict.sourceAi}
          </span>
        )}
      </div>

      <div
        role="meter"
        aria-label={dict.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? dict.unknown : `${value} — ${caption}`}
      >
        {kind === "score" ? (
          // A 0–100 score: continuous fill, plus one pip per milestone of the author's table.
          <>
            <div className={styles.bar}>
              <span className={styles.fill} style={{ width: `${percent}%` }} />
            </div>
            {rows.length > 0 && (
              <div className={styles.pips} aria-hidden="true">
                {rows.map((r, i) => (
                  <span key={i} className={styles.pip} data-state={r.state} title={`${rowName(r, dict)}: ${rowStatus(r, dict)}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          // Stage counts: each block is one stage, so the bar itself reads "5 of 8".
          <div className={styles.segs} aria-hidden="true">
            {(rows.length ? rows : Array.from({ length: 6 }, () => null)).map((r, i) => (
              <span
                key={i}
                className={styles.seg}
                data-state={r?.state ?? "unknown"}
                style={{ flexGrow: r?.weight ?? 1 }}
                title={r ? `${rowName(r, dict)}: ${rowStatus(r, dict)}` : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <p className={styles.caption}>{caption}</p>
      {nextText && (
        <p className={styles.next}>
          <span aria-hidden="true">▸ </span>
          {nextText}
          {next?.status && (
            <span className={styles.nextStatus} lang="en">
              {" "}
              — {next.status}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** Every stage with the author's own wording (or ours for the AI estimate), for the card drawer. */
export function StageList({ progress, dict }: Props) {
  if (!progress.rows.length) return <p className={styles.note}>{dict.unknown}</p>;
  const isAuthor = progress.source === "author";
  return (
    <div>
      <ol className={styles.stageList}>
        {progress.rows.map((r, i) => (
          <li key={i} data-state={r.state}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.stageName} lang={isAuthor ? "en" : undefined}>
              {rowName(r, dict)}
            </span>
            <span className={styles.stageStatus} lang={isAuthor ? "en" : undefined}>
              {rowStatus(r, dict)}
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{isAuthor ? dict.noteAuthorStages : dict.note}</p>
    </div>
  );
}
