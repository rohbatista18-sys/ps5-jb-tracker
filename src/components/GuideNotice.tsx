"use client";

import { useSyncExternalStore } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./GuideNotice.module.css";

const GUIDE_URL = "https://ps5-jb-guide.vercel.app/";
const STORAGE_KEY = "ps5jb:guide-notice-closed";

// In-memory fallback so the notice still closes when storage is blocked.
let closedThisVisit = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isClosed = () => {
  if (closedThisVisit) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

/** Dismissible pointer to the guide site; once closed it stays closed in this browser. */
export default function GuideNotice({ dict, newTab }: { dict: Dictionary["guide"]; newTab: string }) {
  // Closed on the server, so visitors who dismissed it never see it flash in.
  const closed = useSyncExternalStore(subscribe, isClosed, () => true);
  if (closed) return null;

  const close = () => {
    closedThisVisit = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    listeners.forEach((fn) => fn());
  };

  return (
    <aside className={styles.notice} aria-label={dict.label}>
      <span className={styles.badge}>{dict.label}</span>
      <p className={styles.text}>
        {dict.text}{" "}
        <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {dict.link} →<span className="sr-only"> {newTab}</span>
        </a>
      </p>
      <button type="button" className={styles.close} onClick={close} aria-label={dict.close} title={dict.close}>
        ✕
      </button>
    </aside>
  );
}
