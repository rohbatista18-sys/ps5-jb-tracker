import type { DashboardData } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import RelativeTime from "./RelativeTime";
import styles from "./OverallSummary.module.css";

interface Props {
  overall: DashboardData["overall"];
  locale: Locale;
  dict: Dictionary["overall"];
  aiHint: string;
}

export default function OverallSummary({ overall, locale, dict, aiHint }: Props) {
  return (
    <section className={styles.dialog} aria-labelledby="overall-title">
      <h2 id="overall-title" className={styles.title}>
        {dict.title}
      </h2>
      <div className={styles.body}>
        <p className={styles.text}>
          {overall.text[locale]}
          <span className={styles.cursor} aria-hidden="true" />
        </p>
        <footer className={styles.footer}>
          {overall.fallback && <span className={styles.hint}>{aiHint}</span>}
          <span>
            {dict.generatedAt} <RelativeTime iso={overall.generatedAt} locale={locale} className={styles.time} />
          </span>
        </footer>
      </div>
    </section>
  );
}

export function OverallSummarySkeleton({ dict }: { dict: Dictionary["overall"] }) {
  return (
    <div className={styles.dialog} aria-hidden="true">
      <span className={styles.title}>{dict.title}</span>
      <div className={`${styles.body} ${styles.loading}`}>
        {dict.loading}<span className={styles.cursor} />
      </div>
    </div>
  );
}
