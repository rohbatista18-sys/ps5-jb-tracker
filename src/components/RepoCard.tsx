import type { RepoView, XPost } from "@/lib/types";
import { progressOf } from "@/lib/progress";
import { INTL_TAG, type Locale } from "@/i18n/config";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import CardDrawer, { type DrawerItem } from "./CardDrawer";
import Clamp from "./Clamp";
import DonateLinks from "./DonateLinks";
import ProgressBar, { StageList } from "./ProgressBar";
import Reactions from "./Reactions";
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

const truncate = (s: string, max = 72) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// The featured post is the newest one that is not a reply ("@someone lol" makes a poor headline).
const featured = (posts: XPost[]) => posts.find((p) => p.kind !== "reply") ?? posts[0] ?? null;

interface Props {
  repo: RepoView;
  locale: Locale;
  dict: Dictionary;
}

function Post({ p, locale, dict, clamp }: { p: XPost; locale: Locale; dict: Dictionary; clamp: number }) {
  return (
    <li className={styles.post} data-kind={p.kind}>
      <div className={styles.postHead}>
        <span className={styles.postKind}>
          {p.kind === "reply" ? dict.xPosts.reply : p.kind === "repost" ? fill(dict.xPosts.repost, { author: p.author }) : "𝕏"}
        </span>
        <RelativeTime iso={p.date} locale={locale} mode="relative" className={styles.postTime} />
      </div>
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.postText}
        style={{ "--clamp": clamp } as React.CSSProperties}
        lang="en"
      >
        {p.text}
        <span className="sr-only"> {dict.card.newTab}</span>
      </a>
    </li>
  );
}

/*
 * Four rows shared with the sibling cards (CSS subgrid), so the "scoreboard" lines up across devs:
 * 1 identity · 2 progress · 3 recent activity (last commit + featured X post) · 4 everything else.
 */
export default function RepoCard({ repo, locale, dict }: Props) {
  const t = dict.card;
  const starsFmt = new Intl.NumberFormat(INTL_TAG[locale], { notation: "compact" });
  const { config, summary } = repo;
  const slug = `${config.owner}/${config.repo}`;
  const titleId = `repo-${config.id}`;
  const commits = repo.recentCommits.slice(0, 3);
  const posts = repo.xPosts?.posts ?? [];
  const top = featured(posts);
  const repoUrl = `https://github.com/${config.owner}/${config.repo}`;
  const progress = progressOf(repo);

  const drawer: DrawerItem[] = [];
  if (progress.rows.length) {
    drawer.push({
      key: "stages",
      label: fill(dict.progress.tabStages, {
        done: progress.rows.filter((r) => r.state === "done").length,
        total: progress.rows.length,
      }),
      content: <StageList progress={progress} dict={dict.progress} />,
    });
  }
  if (posts.length) {
    drawer.push({
      key: "posts",
      label: fill(dict.xPosts.tab, { n: posts.length }),
      content: (
        <>
          {repo.xPosts?.stale && <p className={styles.note}>{dict.xPosts.stale}</p>}
          <ol className={styles.postList}>
            {posts.map((p) => (
              <Post key={p.id} p={p} locale={locale} dict={dict} clamp={4} />
            ))}
          </ol>
          <p className={styles.note}>{dict.xPosts.original}</p>
        </>
      ),
    });
  }
  if (commits.length) {
    drawer.push({
      key: "commits",
      label: fill(t.tabCommits, { n: commits.length }),
      content: (
        <ol className={styles.commits}>
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
      ),
    });
  }

  return (
    <article
      id={`dev-${config.id}`}
      data-dev={config.id}
      className={`px-box ${styles.card}`}
      data-status={summary.status}
      aria-labelledby={titleId}
    >
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
        <div className={styles.meta}>
          <a className={styles.repoLink} href={githubUrl(repo.htmlUrl, repoUrl)} target="_blank" rel="noopener noreferrer" title={slug}>
            {config.repo}
            <span className="sr-only"> ({slug}) {t.newTab}</span>
          </a>
          {config.x && (
            <a
              className={styles.xLink}
              href={`https://x.com/${config.x}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${fill(t.xProfile, { name: config.nickname })} ${t.newTab}`}
            >
              <span aria-hidden="true">𝕏</span> @{config.x}
            </a>
          )}
          <span className={styles.stars} title={`${repo.stars} ${t.stars}`}>
            <span aria-hidden="true">★</span> {starsFmt.format(repo.stars)}
            <span className="sr-only"> {t.stars}</span>
          </span>
        </div>
      </header>

      <ProgressBar progress={progress} dict={dict.progress} />

      <section className={styles.activity} aria-label={t.activity}>
        <p className={styles.lastCommit}>
          <span className={styles.label}>{t.lastCommit}</span>{" "}
          {repo.lastCommit ? (
            <RelativeTime iso={repo.lastCommit.date} locale={locale} mode="relative" className={styles.commitWhen} />
          ) : (
            <span>{t.noCommits}</span>
          )}
        </p>
        {top ? (
          <ol className={styles.postList} aria-label={dict.xPosts.latest}>
            <Post p={top} locale={locale} dict={dict} clamp={3} />
          </ol>
        ) : (
          <>
            <p className={styles.noX}>{config.x ? dict.xPosts.unavailable : dict.xPosts.none}</p>
            {/* No post to show: the latest commit message keeps this row informative. */}
            {repo.lastCommit && (
              <a
                className={styles.commitLine}
                href={githubUrl(repo.lastCommit.url, repoUrl)}
                target="_blank"
                rel="noopener noreferrer"
                lang="en"
              >
                <code className={styles.sha}>{repo.lastCommit.sha.slice(0, 7)}</code> {repo.lastCommit.message}
                <span className="sr-only"> {t.newTab}</span>
              </a>
            )}
          </>
        )}
      </section>

      <div className={styles.flow}>
        {repo.error && (
          <p className={styles.error} role="status">
            <strong>{t.githubErrorStrong}</strong> {t.githubErrorRest}
          </p>
        )}
        <Clamp lines={3} more={t.more} less={t.less} className={styles.summary}>
          <p>{summary.text[locale]}</p>
        </Clamp>
        {summary.fallback && <p className={styles.aiHint}>{t.aiHint}</p>}
        <CardDrawer items={drawer} label={t.details} />
        <DonateLinks
          nickname={config.nickname}
          donations={config.donations}
          hasNote={!!config.donationNote}
          dict={dict.donate}
          newTab={t.newTab}
        />
        <Reactions repo={config.id} nickname={config.nickname} locale={INTL_TAG[locale]} text={dict.reactions} />
      </div>
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
      <span className={styles.bone} style={{ width: "100%", height: 96 }} />
      <span className={styles.bone} style={{ width: "100%", height: 64 }} />
      <span className={styles.bone} style={{ width: "92%" }} />
      <span className={styles.bone} style={{ width: "60%" }} />
      <span className={styles.bone} style={{ width: "100%", height: 96 }} />
    </div>
  );
}
