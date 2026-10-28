import { STAGES, type Stage, type StageState } from "@/lib/types";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./ProgressBar.module.css";

const STATE_VALUE: Record<StageState, number> = { done: 1, partial: 0.5, none: 0 };

export function progressPercent(stages: Record<Stage, StageState>) {
  return Math.round(STAGES.reduce((sum, s) => sum + s.weight * STATE_VALUE[stages[s.id]], 0));
}

interface Props {
  stages?: Record<Stage, StageState>;
  dict: Dictionary["progress"];
}

export default function ProgressBar({ stages, dict }: Props) {
  const percent = stages ? progressPercent(stages) : null;

  return (
    <section className={styles.progress} aria-label={dict.title}>
      <div className={styles.head}>
        <span className={styles.title}>{dict.title}</span>
        <span className={styles.value}>{percent === null ? "?" : `~${percent}%`}</span>
      </div>

      <div
        className={styles.bar}
        role="meter"
        aria-label={dict.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? dict.unknown : `~${percent}%`}
      >
        {STAGES.map((s) => (
          <span
            key={s.id}
            className={styles.segment}
            data-state={stages?.[s.id] ?? "unknown"}
            style={{ flexGrow: s.weight }}
            title={`${dict.stages[s.id]}: ${stages ? dict.states[stages[s.id]] : dict.unknown}`}
          />
        ))}
      </div>

      {stages ? (
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
          <p className={styles.note}>{dict.note}</p>
        </div>
      ) : (
        <p className={styles.note}>{dict.unknown}</p>
      )}
    </section>
  );
}
