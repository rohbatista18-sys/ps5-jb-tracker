import { STAGES, type SelfReport, type Stage, type StageState } from "@/lib/types";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import styles from "./ProgressBar.module.css";

const STATE_VALUE: Record<StageState, number> = { done: 1, partial: 0.5, none: 0 };

export function progressPercent(stages: Record<Stage, StageState>) {
  return Math.round(STAGES.reduce((sum, s) => sum + s.weight * STATE_VALUE[stages[s.id]], 0));
}

interface Props {
  stages?: Record<Stage, StageState>;
  selfReport: SelfReport | null;
  dict: Dictionary["progress"];
}

export default function ProgressBar({ stages, selfReport, dict }: Props) {
  // The researcher's own published figure wins; the AI stage estimate is the fallback.
  const percent = selfReport ? selfReport.percent : stages ? progressPercent(stages) : null;
  const title = selfReport ? dict.titleAuthor : dict.title;
  const value = percent === null ? "?" : selfReport ? `${percent}%` : `~${percent}%`;
  const source =
    selfReport &&
    fill(selfReport.kind === "score" ? dict.authorScore : dict.authorStages, {
      done: selfReport.done,
      total: selfReport.total,
    });

  return (
    <section className={styles.progress} aria-label={dict.title}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.value}>{value}</span>
      </div>

      <div
        className={styles.bar}
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? dict.unknown : source ? `${value} (${source})` : value}
      >
        {selfReport ? (
          <span className={styles.fill} style={{ width: `${selfReport.percent}%` }} />
        ) : STAGES.map((s) => (
          <span
            key={s.id}
            className={styles.segment}
            data-state={stages?.[s.id] ?? "unknown"}
            style={{ flexGrow: s.weight }}
            title={`${dict.stages[s.id]}: ${stages ? dict.states[stages[s.id]] : dict.unknown}`}
          />
        ))}
      </div>
      {source && <p className={styles.source}>{source}</p>}

      {selfReport?.stages ? (
        <div className={styles.details}>
          <h3 className={styles.detailsTitle}>{dict.detailsAuthor}</h3>
          <ol className={styles.authorList}>
            {selfReport.stages.map((s, i) => (
              <li key={i} data-state={s.state}>
                <span className={styles.dot} aria-hidden="true" />
                <span>{s.name}</span>
                <span className={styles.state}>{s.status}</span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>{dict.noteAuthorStages}</p>
        </div>
      ) : stages ? (
        <div className={styles.details}>
          <h3 className={styles.detailsTitle}>{dict.details}</h3>
          <ol>
            {STAGES.map((s) => (
              <li key={s.id} data-state={stages[s.id]}>
                <span className={styles.dot} aria-hidden="true" />
                <span>{dict.stages[s.id]}</span>
                <span className={styles.state}>{dict.states[stages[s.id]]}</span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>{selfReport ? dict.noteAuthor : dict.note}</p>
        </div>
      ) : (
        <p className={styles.note}>{dict.unknown}</p>
      )}
    </section>
  );
}
