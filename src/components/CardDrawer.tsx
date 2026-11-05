"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import SectionHead from "./SectionHead";
import styles from "./CardDrawer.module.css";

export interface DrawerItem {
  key: string;
  label: string;
  count?: number | string;
  content: ReactNode; // rendered on the server
}

/**
 * "See all": a strip of tabs resting on a baseline; the open tab merges into its panel. They are
 * disclosures (aria-expanded), not ARIA tabs, since all of them may be closed. Esc closes a panel.
 */
export default function CardDrawer({ items, heading }: { items: DrawerItem[]; heading: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  if (!items.length) return null;

  return (
    <section className={styles.drawer} aria-labelledby={`${base}-h`}>
      <SectionHead id={`${base}-h`} role="neutral">
        {heading}
      </SectionHead>
      <div className={styles.tabs} role="group" aria-labelledby={`${base}-h`}>
        {items.map((it) => (
          <button
            key={it.key}
            ref={(el) => {
              buttons.current[it.key] = el;
            }}
            type="button"
            className={styles.tab}
            aria-expanded={open === it.key}
            aria-controls={`${base}-${it.key}`}
            onClick={() => setOpen((o) => (o === it.key ? null : it.key))}
          >
            {it.label}
            {it.count !== undefined && <span className={styles.count}>{it.count}</span>}
          </button>
        ))}
      </div>
      {items.map((it) => (
        <div
          key={it.key}
          id={`${base}-${it.key}`}
          className={styles.panel}
          hidden={open !== it.key}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            setOpen(null);
            buttons.current[it.key]?.focus();
          }}
        >
          {it.content}
        </div>
      ))}
    </section>
  );
}
