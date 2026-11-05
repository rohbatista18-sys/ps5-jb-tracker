"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import styles from "./DevSwitcher.module.css";

export interface DevTile {
  id: string;
  nickname: string;
  value: string; // "65%", "~8%", "?"
  percent: number | null;
  source: "author" | "ai" | null;
  sourceLabel: string;
}

interface Props {
  tiles: DevTile[];
  label: string;
  nextLabel: string; // "Next: {name}"
  gridClass: string;
  children: ReactNode; // the cards, rendered on the server
}

/*
 * Mobile only (<760px): a 2×2 "player select" that shows one dev card at a time, with every dev's
 * number visible at a glance. On wider screens the tiles are hidden and all cards show side by side.
 * Before hydration (or without JS) every card is shown stacked, so nothing is ever blank.
 */
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const noop = () => () => {};

export default function DevSwitcher({ tiles, label, nextLabel, gridClass, children }: Props) {
  // The chosen dev lives in the URL hash (#dev-zig), so a link opens straight on that dev.
  const hash = useSyncExternalStore(subscribeHash, () => location.hash, () => "");
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const fromHash = hash.replace(/^#dev-/, "");
  const active = tiles.some((t) => t.id === fromHash) ? fromHash : (tiles[0]?.id ?? "");
  const top = useRef<HTMLDivElement>(null);

  const choose = (id: string) => {
    history.replaceState(null, "", `#dev-${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const index = tiles.findIndex((t) => t.id === active);
  const next = tiles[(index + 1) % tiles.length];

  return (
    <div className={styles.switcher}>
      <div ref={top} className={styles.tiles} role="group" aria-label={label}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.tile}
            aria-pressed={t.id === active}
            aria-controls={`dev-${t.id}`}
            onClick={() => choose(t.id)}
          >
            <span className={styles.name}>{t.nickname}</span>
            <span className={styles.row}>
              <span className={styles.value} data-source={t.source ?? "none"}>
                {t.value}
              </span>
              {t.source && (
                <span className={styles.source} data-source={t.source}>
                  {t.sourceLabel}
                </span>
              )}
            </span>
            <span className={styles.mini} aria-hidden="true">
              <span style={{ width: `${t.percent ?? 0}%` }} />
            </span>
          </button>
        ))}
      </div>

      <div className={gridClass} data-js={ready || undefined} data-active={active}>
        {children}
      </div>

      {ready && next && tiles.length > 1 && (
        <button
          type="button"
          className={styles.next}
          onClick={() => {
            choose(next.id);
            const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
            top.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          }}
        >
          {nextLabel.replace("{name}", next.nickname)} <span aria-hidden="true">▶</span>
        </button>
      )}
    </div>
  );
}
