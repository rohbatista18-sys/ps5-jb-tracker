import type { RepoView } from "@/lib/types";
import { INTL_TAG, type Locale } from "@/i18n/config";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import DonateLinks from "./DonateLinks";
import ProgressBar from "./ProgressBar";
import RelativeTime from "./RelativeTime";
import styles from "./RepoCard.module.css";

// Links built from GitHub API data must stay on github.com (defense in depth against
// `javascript:` or look-alike URLs if the API response were ever tampered with).
const githubUrl = (url: string, fallback: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "github.com" ? u.href : fallback;
  } catch {
    return fallback;
  }
};

const truncate =(s: string, max = 72) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
interface Props {
  repo: RepoView;
  locale: Locale;
  dict: Dictionary;
}

export default function RepoCard({ repo, locale, dict }: Props) {
  const t = dict.card;
  const starsFmt = new Intl.NumberFormat(INTL_TAG[locale], { notation: "compact" });
  const { config, summary } = repo;
  const slug = `${config.owner}/${config.repo}`;
  const titleId = `repo-${config.id}`;
  const commits = repo.recentCommits.slice(0, 3);
  const repoUrl = `https://github.com/${config.owner}/${config.repo}`;

  return (
    <article className={`px-box ${styles.card}`} data-status={summary.status} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 id={titleId} className={styles.nickname}>
            {config.nickname}
          </h2>
          <span className={styles.badge} data-status={summary.status}>
            <span className="sr-only">Status: </span>
            {dict.status[summary.status]}
          </span>
        </div>
        <a className={styles.repoLink} href={githubUrl(repo.htmlUrl, repoUrl)} target="_blank" rel="noopener noreferrer">
          {slug}
          <span className="sr-only"> {t.newTab}</span>
        </a>
        <div className={styles.meta}>
          <a
            className={styles.xLink}
            href={`https://x.com/${config.x}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${fill(t.xProfile, { name: config.nickname })} ${t.newTab}`}
          >
            <span aria-hidden="true">𝕏</span> @{config.x}
          </a>
          <span className={styles.stars} title={`${repo.stars} ${t.stars}`}>
            <span aria-hidden="true">★</span> {starsFmt.format(repo.stars)}
            <span className="sr-only"> {t.stars}</span>
          </span>
        </div>
        <DonateLinks
          nickname={config.nickname}
          donations={config.donations}
          hasNote={!!config.donationNote}
          dict={dict.donate}
          newTab={t.newTab}
        />
      </header>

      {/* Card children map 1:1 to the shared subgrid rows: header, progress, summary, updated, commits. */}
      <ProgressBar stages={summary.stages} dict={dict.progress} />

      <section className={styles.summary} aria-label={t.summary}>
        {repo.error && (
          <p className={styles.error} role="status">
            <strong>{t.githubErrorStrong}</strong> {t.githubErrorRest}
          </p>
        )}
        <p>{summary.text[locale]}</p>
        {summary.fallback && <p className={styles.aiHint}>{t.aiHint}</p>}
      </section>

      <div className={styles.updated}>
        <span className={styles.label}>{t.lastUpdate}</span>
        {repo.lastCommit ? (
          <RelativeTime iso={repo.lastCommit.date} locale={locale} className={styles.updatedTime} />
        ) : (
          <span className={styles.updatedTime}>{t.noCommits}</span>
        )}
      </div>

      {commits.length > 0 && (
        <section className={styles.commits} aria-label={t.recentCommits}>
          <h3 className={styles.label}>{t.recentCommits}</h3>
          <ol>
            {commits.map((c) => (
              <li key={c.sha}>
                <a href={githubUrl(c.url, repoUrl)} target="_blank" rel="noopener noreferrer" title={c.message}>
                  <code className={styles.sha}>{c.sha.slice(0, 7)}</code>
                  <span className={styles.message}>{truncate(c.message)}</span>
                </a>
                <RelativeTime iso={c.date} locale={locale} mode="relative" className={styles.commitTime} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

export function RepoCardSkeleton() {
  return (
    <div className={`px-box ${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.titleRow}>
        <span className={styles.bone} style={{ width: "40%", height: 22 }} />
        <span className={styles.bone} style={{ width: "28%", height: 18 }} />
      </div>
      <span className={styles.bone} style={{ width: "70%" }} />
      <span className={styles.bone} style={{ width: "100%", height: 40 }} />
      <span className={styles.bone} style={{ width: "100%" }} />
      <span className={styles.bone} style={{ width: "92%" }} />
      <span className={styles.bone} style={{ width: "60%" }} />
      <span className={styles.bone} style={{ width: "100%", height: 48 }} />
    </div>
  );
}
