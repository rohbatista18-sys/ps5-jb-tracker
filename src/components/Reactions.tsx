"use client";

import { useRef, useState } from "react";
import { REACTIONS, type ReactionKey } from "@/lib/reactions-config";
import { sendReaction, useReactions } from "@/hooks/useReactions";
import styles from "./Reactions.module.css";

interface Props {
  repo: string;
  nickname: string;
  locale: string;
  text: { title: string; total: string; send: string; slowDown: string; names: Record<ReactionKey, string> };
}

interface Burst {
  id: number;
  emoji: string;
  x: number;
}

export default function Reactions({ repo, nickname, locale, text }: Props) {
  const counts = useReactions(repo);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [warning, setWarning] = useState(false);
  const nextId = useRef(0);
  const fmt = new Intl.NumberFormat(locale, { notation: "compact" });
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  async function react(key: ReactionKey, emoji: string, x: number) {
    const id = nextId.current++;
    setBursts((b) => [...b.slice(-11), { id, emoji, x }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 900);
    const ok = await sendReaction(repo, key);
    setWarning(!ok);
  }

  return (
    <section className={styles.reactions} aria-label={`${text.title} — ${nickname}`}>
      <div className={styles.head}>
        <span className={styles.title}>{text.title}</span>
        <span className={styles.total} aria-live="polite">
          {total === null ? "…" : text.total.replace("{n}", fmt.format(total))}
        </span>
      </div>

      <ul className={styles.list}>
        {REACTIONS.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              className={styles.button}
              aria-label={`${text.send} ${text.names[r.key]} — ${nickname}`}
              title={text.names[r.key]}
              onClick={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const parent = e.currentTarget.closest("section")!.getBoundingClientRect();
                react(r.key, r.emoji, box.left - parent.left + box.width / 2);
              }}
            >
              <span className={styles.emoji} aria-hidden="true">
                {r.emoji}
              </span>
              <span className={styles.count}>{counts ? fmt.format(counts[r.key]) : "·"}</span>
            </button>
          </li>
        ))}
      </ul>

      {warning && <p className={styles.warning}>{text.slowDown}</p>}

      <div className={styles.bursts} aria-hidden="true">
        {bursts.map((b) => (
          <span key={b.id} className={styles.burst} style={{ left: b.x }}>
            {b.emoji}
          </span>
        ))}
      </div>
    </section>
  );
}
