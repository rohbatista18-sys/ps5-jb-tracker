import type { Progress, ProgressRow } from "@/lib/progress";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import SectionHead, { SourceTag } from "./SectionHead";
import styles from "./ProgressBar.module.css";

interface Props {
  progress: Progress;
  dict: Dictionary["progress"];
  id: string;
}

const rowName = (r: ProgressRow, dict: Dictionary["progress"]) => r.name ?? (r.stage ? dict.stages[r.stage] : "");
const rowStatus = (r: ProgressRow, dict: Dictionary["progress"]) => r.status ?? dict.states[r.state];

/** Caption with the unit; the source is the tag in the header, so it is not repeated here. */
function captionOf(progress: Progress, dict: Dictionary["progress"]) {
  const { source, kind, done, total, partial, rowsDone, rows } = progress;
  if (source === "ai") return fill(dict.noteAiShort, { done, total });
  if (source !== "author") return dict.unknown;
  if (kind === "score") {
    const points = fill(dict.authorScore, { done, total });
    return rows.length ? `${points} · ${fill(dict.scoreRows, { done: rowsDone, total: rows.length })}` : points;
  }
  return fill(partial ? dict.authorStagesPartial : dict.authorStages, { done, total, partial });
}

/** Progress panel: header with the source tag, big number + caption, one bar, the next stage. */
export default function ProgressBar({ progress, dict, id }: Props) {
  const { percent, source, kind, rows, next } = progress;
  const value = percent === null ? "?" : source === "ai" ? `~${percent}%` : `${percent}%`;
  const caption = captionOf(progress, dict);
  const sourceLabel = source === "author" ? dict.sourceAuthor : source === "ai" ? dict.sourceAi : null;
  const isAuthor = source === "author";

  return (
    <section className={styles.progress} aria-labelledby={id} data-source={source ?? "none"}>
      <SectionHead
        id={id}
        role="progress"
        aside={sourceLabel && <SourceTag src={isAuthor ? "author" : "ai"}>{sourceLabel}</SourceTag>}
      >
        {dict.section}
        {sourceLabel && <span className="sr-only"> — {sourceLabel}</span>}
      </SectionHead>

      <div className={styles.hero}>
        <span className={styles.pct}>{value}</span>
        <p className={styles.caption}>{caption}</p>
      </div>

      <div
        role="meter"
        aria-label={dict.section}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? dict.unknown : `${value} — ${sourceLabel}: ${caption}`}
      >
        {kind === "score" ? (
          <div className={styles.bar}>
            <span className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
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

      {next ? (
        <p className={styles.next}>
          <span className={styles.nextLabel}>▸ {dict.nextLabel}</span>{" "}
          <span className={styles.nextName} lang={isAuthor ? "en" : undefined}>
            {rowName(next, dict)}
          </span>
          {next.status && (
            <span className={styles.nextStatus} lang="en">
              {" "}
              ({next.status})
            </span>
          )}
        </p>
      ) : (
        rows.length > 0 && isAuthor && <p className={styles.next}>{dict.allDone}</p>
      )}
    </section>
  );
}

/** Every stage with the author's own wording (or ours for the AI estimate), for the card drawer. */
export function StageList({ progress, dict }: Omit<Props, "id">) {
  if (!progress.rows.length) return <p className={styles.note}>{dict.unknown}</p>;
  const isAuthor = progress.source === "author";
  return (
    <div>
      <p className={styles.panelTitle}>{isAuthor ? dict.panelAuthor : dict.panelAi}</p>
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
