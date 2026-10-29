import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getNews } from "@/lib/news";
import RelativeTime from "./RelativeTime";
import styles from "./NewsSection.module.css";

interface Props {
  locale: Locale;
  dict: Dictionary["news"];
  newTab: string;
}

export default async function NewsSection({ locale, dict, newTab }: Props) {
  const items = await getNews(locale);
  return (
    <section className={`px-box ${styles.news}`} aria-labelledby="news-title">
      <header className={styles.head}>
        <h2 id="news-title" className={styles.title}>
          {dict.title}
        </h2>
        <p className={styles.subtitle}>{dict.subtitle}</p>
      </header>

      {items.length ? (
        <ol className={styles.list}>
          {items.map((item) => (
            <li key={item.url} className={styles.item}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {item.title}
                <span className="sr-only"> {newTab}</span>
              </a>
              <span className={styles.meta}>
                <span className={styles.source}>{item.source}</span>
                <RelativeTime iso={item.publishedAt} locale={locale} mode="relative" className={styles.time} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>{dict.empty}</p>
      )}

      <p className={styles.disclaimer}>{dict.disclaimer}</p>
    </section>
  );
}

export function NewsSkeleton({ dict }: { dict: Dictionary["news"] }) {
  return (
    <section className={`px-box ${styles.news}`} aria-hidden="true">
      <h2 className={styles.title}>{dict.title}</h2>
      <p className={styles.empty}>…</p>
    </section>
  );
}
