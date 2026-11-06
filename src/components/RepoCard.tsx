import type { RepoConfig, RepoView, XPost } from "@/lib/types";
import { progressOf } from "@/lib/progress";
import { INTL_TAG, type Locale } from "@/i18n/config";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import CardDrawer, { type DrawerItem } from "./CardDrawer";
import Clamp from "./Clamp";
import DonateLinks from "./DonateLinks";
import ProgressBar, { StageList } from "./ProgressBar";
import Reactions from "./Reactions";
import RelativeTime from "./RelativeTime";
import SectionHead, { SourceTag } from "./SectionHead";
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

const own = (p: XPost, x?: string) =>
  p.kind === "post" || (p.kind === "repost" && !!x && p.author.toLowerCase() === x.toLowerCase());

// Featured post: the dev's own words first (a repost of themselves counts), then someone else's
// repost, then a reply ("@someone lol" makes a poor headline).
const featured = (posts: XPost[], x?: string) =>
  posts.find((p) => own(p, x)) ?? posts.find((p) => p.kind === "repost") ?? posts[0] ?? null;

interface Props {
  repo: RepoView;
  locale: Locale;
  dict: Dictionary;
}

interface PostProps {
  p: XPost;
  config: RepoConfig;
  locale: Locale;
  dict: Dictionary;
  clamp: number;
}

/** One X post: provenance tag (X / reply / someone else's repost), time, EN marker, 3–4 lines. */
function Post({ p, config, locale, dict, clamp }: PostProps) {
  const t = dict.xPosts;
  const kind = own(p, config.x) ? "post" : p.kind;
  return (
    <li className={styles.post} data-kind={kind}>
      <div className={styles.postHead}>
        {kind === "repost" ? (
          <>
            <SourceTag src="repost">{t.repost}</SourceTag>
            <span className={styles.postWho}>@{p.author}</span>
          </>
        ) : (
          <>
            <SourceTag src="x">{kind === "reply" ? t.reply : t.tagX}</SourceTag>
            <span className={styles.postWho}>@{config.x}</span>
          </>
        )}
        <RelativeTime iso={p.date} locale={locale} mode="relative" className={styles.time} />
        {locale !== "en" && (
          <abbr className={styles.lang} title={t.langTagTitle}>
            {t.langTag}
            <span className="sr-only"> — {t.langTagTitle}</span>
          </abbr>
        )}
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
 * Four rows shared with the sibling cards (CSS subgrid), so sections line up across devs:
 * 1 identity · 2 progress · 3 activity (GitHub + X) · 4 AI summary, "see all" drawer, community.
 * Every block says where it comes from: solid tag = the dev / GitHub, dashed = our AI.
 */
export default function RepoCard({ repo, locale, dict }: Props) {
  const t = dict.card;
  const starsFmt = new Intl.NumberFormat(INTL_TAG[locale], { notation: "compact" });
  const { config, summary } = repo;
  const slug = `${config.owner}/${config.repo}`;
  const id = `repo-${config.id}`;
  const commits = repo.recentCommits.slice(0, 3);
  const posts = repo.xPosts?.posts ?? [];
  const top = featured(posts, config.x);
  const repoUrl = `https://github.com/${config.owner}/${config.repo}`;
  const progress = progressOf(repo);

  const drawer: DrawerItem[] = [];
  if (progress.rows.length) {
    drawer.push({
      key: "stages",
      label: t.tabStages,
      count: `${progress.rowsDone}/${progress.rows.length}`,
      content: <StageList progress={progress} dict={dict.progress} />,
    });
  }
  if (posts.length) {
    drawer.push({
      key: "posts",
      label: dict.xPosts.tab,
      count: posts.length,
      content: (
        <>
          <p className={styles.panelTitle}>{fill(dict.xPosts.title, { n: posts.length })}</p>
          {repo.xPosts?.stale && <p className={styles.note}>{dict.xPosts.stale}</p>}
          <ol className={styles.postList}>
            {posts.map((p) => (
              <Post key={p.id} p={p} config={config} locale={locale} dict={dict} clamp={4} />
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
      label: t.tabCommits,
      count: commits.length,
      content: (
        <>
          <p className={styles.panelTitle}>{fill(t.commitsPanel, { n: commits.length })}</p>
          <ol className={styles.commits}>
            {commits.map((c) => (
              <li key={c.sha}>
                <a href={githubUrl(c.url, repoUrl)} target="_blank" rel="noopener noreferrer" title={c.message}>
                  <code className={styles.sha}>{c.sha.slice(0, 7)}</code>
                  <span className={styles.message} lang="en">
                    {truncate(c.message)}
                  </span>
                </a>
                <RelativeTime iso={c.date} locale={locale} mode="relative" className={styles.time} />
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  return (
    <article
      id={`dev-${config.id}`}
      data-dev={config.id}
      className={`px-box ${styles.card}`}
      data-status={summary.status}
      aria-labelledby={id}
    >
      {/* 1 · identity */}
      <header className={styles.header}>
        <h2 id={id} className={styles.nickname}>
          {config.nickname}
        </h2>
        <p className={styles.meta}>
          <span className={styles.metaLabel}>{t.repo}</span>
          <a
            className={styles.repoLink}
            href={githubUrl(repo.htmlUrl, repoUrl)}
            target="_blank"
            rel="noopener noreferrer"
            title={slug}
          >
            {config.repo}
            <span className="sr-only">
              {" "}
              ({slug}) {t.newTab}
            </span>
          </a>
          <span aria-hidden="true">·</span>
          <span className={styles.stars} title={`${repo.stars} ${t.stars}`}>
            <span aria-hidden="true">★</span> {starsFmt.format(repo.stars)}
            <span className="sr-only"> {t.stars}</span>
          </span>
        </p>
      </header>

      {/* 2 · progress */}
      <ProgressBar progress={progress} dict={dict.progress} id={`${id}-progress`} />

      {/* 3 · activity: GitHub, then the dev's own words on X */}
      <section className={styles.section} aria-labelledby={`${id}-act`}>
        <SectionHead
          id={`${id}-act`}
          role="dev"
          aside={
            <>
              <SourceTag src="github">{t.github}</SourceTag>
              <span className="sr-only">{t.lastCommitShort}</span>
              {repo.lastCommit ? (
                <RelativeTime iso={repo.lastCommit.date} locale={locale} mode="relative" className={styles.time} />
              ) : (
                <span>{t.noCommits}</span>
              )}
            </>
          }
        >
          {t.activityTitle}
        </SectionHead>
        {top ? (
          <ol className={styles.postList}>
            <Post p={top} config={config} locale={locale} dict={dict} clamp={3} />
          </ol>
        ) : (
          <>
            {/* No post to show: the latest commit message, styled as GitHub data. */}
            {repo.lastCommit && (
              <a
                className={styles.commitLine}
                href={githubUrl(repo.lastCommit.url, repoUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code className={styles.sha}>{repo.lastCommit.sha.slice(0, 7)}</code>{" "}
                <span lang="en">{repo.lastCommit.message}</span>
                <span className="sr-only"> {t.newTab}</span>
              </a>
            )}
            <p className={styles.noX}>
              <SourceTag src="x">{dict.xPosts.tagX}</SourceTag>{" "}
              {config.x ? `@${config.x} · ${dict.xPosts.unavailable}` : dict.xPosts.none}
            </p>
          </>
        )}
      </section>

      {/* 4 · reading zone (AI summary, see all) + community zone pinned to the bottom */}
      <div className={styles.flow}>
        {repo.error && (
          <p className={styles.error} role="status">
            <strong>{t.githubErrorStrong}</strong> {t.githubErrorRest}
          </p>
        )}
        <section className={styles.section} aria-labelledby={`${id}-sum`}>
          <Clamp
            lines={3}
            more={t.more}
            less={t.less}
            className={styles.summary}
            head={{
              id: `${id}-sum`,
              role: "ai",
              label: t.aiTitle,
              tag: (
                <SourceTag src="ai">
                  {t.aiTag}
                  {summary.status !== "unknown" && (
                    <>
                      <span className="sr-only"> — {t.aiStatusSr}</span> · {dict.status[summary.status]}
                    </>
                  )}
                </SourceTag>
              ),
            }}
          >
            <p>{summary.text[locale] ?? summary.text.en}</p>
          </Clamp>
          {summary.fallback && <p className={styles.aiHint}>{t.aiHint}</p>}
        </section>

        <CardDrawer items={drawer} heading={t.details} />

        <div className={styles.community}>
          <DonateLinks
            nickname={config.nickname}
            donations={config.donations}
            hasNote={!!config.donationNote}
            dict={dict.donate}
            newTab={t.newTab}
            id={`${id}-support`}
          />
          <Reactions repo={config.id} nickname={config.nickname} locale={INTL_TAG[locale]} text={dict.reactions} />
        </div>
      </div>
    </article>
  );
}

export function RepoCardSkeleton() {
  return (
    <div className={`px-box ${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <span className={styles.bone} style={{ width: "50%", height: 22 }} />
      <span className={styles.bone} style={{ width: "70%" }} />
      <span className={styles.bone} style={{ width: "100%", height: 120 }} />
      <span className={styles.bone} style={{ width: "100%", height: 64 }} />
      <span className={styles.bone} style={{ width: "92%" }} />
      <span className={styles.bone} style={{ width: "60%" }} />
      <span className={styles.bone} style={{ width: "100%", height: 96 }} />
    </div>
  );
}
