import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { EXTRA_REPOS } from "@/lib/more-repos";
import NewsDialog from "./NewsDialog";
import styles from "./MoreRepos.module.css";

interface Props {
  locale: Locale;
  dict: Dictionary["moreRepos"];
  newTab: string;
}

export default function MoreRepos({ locale, dict, newTab }: Props) {
  const repos = EXTRA_REPOS;
  return (
    <NewsDialog label={dict.title} closeLabel={dict.close} count={repos.length}>
      <section className={`px-box ${styles.section}`} aria-labelledby="more-repos-title">
        <header className={styles.head}>
          <h2 id="more-repos-title" className={styles.title}>
            {dict.title}
          </h2>
          <p className={styles.subtitle}>{dict.subtitle}</p>
        </header>

        <ol className={styles.list}>
          {repos.map((r) => (
            <li key={`${r.owner}/${r.repo}`} className={styles.item}>
              <a
                href={`https://github.com/${r.owner}/${r.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.repoLink}
              >
                {r.owner}/{r.repo}
                <span className="sr-only"> {newTab}</span>
              </a>
              <span className={styles.fw}>{r.firmware}</span>
              <span className={styles.desc}>{r.description[locale]}</span>
            </li>
          ))}
        </ol>

        <p className={styles.disclaimer}>{dict.disclaimer}</p>
      </section>
    </NewsDialog>
  );
}
