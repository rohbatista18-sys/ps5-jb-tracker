"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./GuideNotice.module.css";

/** Dismissible pointer to the guide site; closing only lasts until the page is reloaded. */
export default function GuideNotice({ dict, url, newTab }: { dict: Dictionary["guide"]; url: string; newTab: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <aside className={styles.notice} aria-label={dict.label}>
      <span className={styles.badge}>{dict.label}</span>
      <p className={styles.text}>
        {dict.text}{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {dict.link} →<span className="sr-only"> {newTab}</span>
        </a>
      </p>
      <button
        type="button"
        className={styles.close}
        onClick={() => setOpen(false)}
        aria-label={dict.close}
        title={dict.close}
      >
        ✕
      </button>
    </aside>
  );
}
