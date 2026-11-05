"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./CardDrawer.module.css";

export interface DrawerItem {
  key: string;
  label: string;
  content: ReactNode; // rendered on the server
}

/** One row of toggle buttons; at most one panel open. Esc inside a panel closes it. */
export default function CardDrawer({ items, label }: { items: DrawerItem[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  if (!items.length) return null;

  return (
    <div className={styles.drawer}>
      <div className={styles.tabs} role="group" aria-label={label}>
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
            <span className={styles.chevron} aria-hidden="true">
              ▸
            </span>
            {it.label}
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
    </div>
  );
}
