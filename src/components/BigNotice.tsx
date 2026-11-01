import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./BigNotice.module.css";

export default function BigNotice({ dict }: { dict: Dictionary["bigNotice"] }) {
  return (
    <section className={styles.notice} role="note" aria-label={dict.title}>
      <p className={styles.title}>{dict.title}</p>
      <p className={styles.subtitle}>{dict.subtitle}</p>
    </section>
  );
}
