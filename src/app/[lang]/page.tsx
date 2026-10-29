import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDashboard } from "@/lib/dashboard";
import RepoCard, { RepoCardSkeleton } from "@/components/RepoCard";
import OverallSummary, { OverallSummarySkeleton } from "@/components/OverallSummary";
import RelativeTime from "@/components/RelativeTime";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PsButtons from "@/components/PsButtons";
import NewsSection, { NewsSkeleton } from "@/components/NewsSection";
import MoreRepos from "@/components/MoreRepos";
import GuideNotice from "@/components/GuideNotice";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import styles from "./page.module.css";

const SITE_SOURCE_URL = "https://github.com/rohbatista18-sys/ps5-jb-tracker";
const SITE_SUPPORT_URL = "https://www.paypal.com/ncp/payment/6R8Q5LX8RY2CQ";

async function LastChecked({ locale }: { locale: Locale }) {
  const { fetchedAt } = await getDashboard();
  return <RelativeTime iso={fetchedAt} locale={locale} className={styles.checkedTime} />;
}

async function Dashboard({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { repos, overall } = await getDashboard();
  // Overall summary first: it answers "how close is the jailbreak?" before any scrolling.
  return (
    <>
      <OverallSummary overall={overall} locale={locale} dict={dict.overall} aiHint={dict.card.aiHint} />
      <div className={styles.grid}>
        {repos.map((repo) => (
          <RepoCard key={repo.config.id} repo={repo} locale={locale} dict={dict} />
        ))}
      </div>
    </>
  );
}

function DashboardSkeleton({ dict }: { dict: Dictionary }) {
  return (
    <div role="status" aria-label={dict.loading} aria-busy="true" className={styles.main}>
      <OverallSummarySkeleton dict={dict.overall} />
      <div className={styles.grid}>
        <RepoCardSkeleton />
        <RepoCardSkeleton />
        <RepoCardSkeleton />
      </div>
    </div>
  );
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <div className={styles.page}>
      <GuideNotice dict={dict.guide} newTab={dict.card.newTab} />
      <header className={styles.header}>
        <LanguageSwitcher current={lang} label={dict.header.language} />
        <PsButtons className={styles.buttons} />
        <h1 className={styles.title}>
          <span className={styles.titleTop}>PS5 14.10</span>
          <span className={styles.titleBottom}>Jailbreak Tracker</span>
        </h1>
        <p className={styles.subtitle}>{dict.header.subtitle}</p>
        <p className={styles.checked}>
          <span className={styles.checkedLabel}>{dict.header.lastChecked}</span>
          <Suspense fallback={<span className={styles.checkedTime}>…</span>}>
            <LastChecked locale={lang} />
          </Suspense>
        </p>
        {/* Both modal buttons on one row, to keep the header short. */}
        <div className={styles.headerActions}>
          <Suspense fallback={<NewsSkeleton dict={dict.news} />}>
            <NewsSection locale={lang} dict={dict.news} newTab={dict.card.newTab} />
          </Suspense>{" "}
          <MoreRepos locale={lang} dict={dict.moreRepos} newTab={dict.card.newTab} />
          <a
            href={SITE_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-btn ${styles.support}`}
            title={dict.header.supportSiteHint}
          >
            <span aria-hidden="true">♥ </span>
            {dict.header.supportSite}
            <span className="sr-only"> — {dict.header.supportSiteHint} {dict.card.newTab}</span>
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <Suspense fallback={<DashboardSkeleton dict={dict} />}>
          <Dashboard locale={lang} dict={dict} />
        </Suspense>
      </main>

      <footer className={styles.footer}>
        <div className={styles.notice} role="note" aria-label={dict.footer.noticeLabel}>
          <p className={styles.warning}>{dict.footer.donationWarning}</p>
          <p>{dict.footer.donations}</p>
          <p>{dict.footer.nonprofit}</p>
          <p>{dict.footer.privacy}</p>
        </div>
        <p>{dict.footer.disclaimer}</p>
        <p className={styles.footerMeta}>
          {dict.footer.meta} ·{" "}
          <a href={SITE_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            {dict.footer.source}
            <span className="sr-only"> {dict.card.newTab}</span>
          </a>
        </p>
      </footer>
    </div>
  );
}
