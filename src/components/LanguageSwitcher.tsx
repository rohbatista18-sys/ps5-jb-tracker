"use client";

import { LOCALE_COOKIE, LOCALE_NAME, LOCALES, type Locale } from "@/i18n/config";
import styles from "./LanguageSwitcher.module.css";

// Functional preference only, set solely on an explicit click; holds just the locale code.
const ONE_YEAR = 60 * 60 * 24 * 365;

export default function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  return (
    <nav className={styles.switcher} aria-label={label}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          hrefLang={l}
          lang={l}
          className={`px-btn ${styles.option}`}
          aria-current={l === current ? "true" : undefined}
          title={LOCALE_NAME[l]}
          onClick={() => {
            const secure = location.protocol === "https:" ? "; secure" : "";
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
          }}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
