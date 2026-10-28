"use client";

import { useRef, useState } from "react";
import { EMOTE_EVENT, reactionsFor, type EmoteDetail, type Reaction, type ReactionKey } from "@/lib/reactions-config";
import { sendReaction, useReactions } from "@/hooks/useReactions";
import FlagBR from "./FlagBR";
import styles from "./Reactions.module.css";

interface Props {
  repo: string;
  nickname: string;
  locale: string;
  text: { title: string; total: string; send: string; slowDown: string; names: Record<ReactionKey, string> };
}

interface Burst {
  id: number;
  reaction: Reaction;
  x: number;
}

const Glyph = ({ r, size }: { r: Reaction; size?: number }) => (r.key === "brazil" ? <FlagBR size={size} /> : r.emoji);

export default function Reactions({ repo, nickname, locale, text }: Props) {
  const counts = useReactions(repo);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [warning, setWarning] = useState(false);
  const nextId = useRef(0);
  const fmt = new Intl.NumberFormat(locale, { notation: "compact" });
  const available = reactionsFor(repo);
  const regular = available.filter((r) => !("only" in r));
  const exclusive = available.filter((r) => "only" in r);
  const total = counts ? available.reduce((sum, r) => sum + counts[r.key], 0) : null;

  async function react(r: Reaction, target: HTMLElement) {
    window.dispatchEvent(new CustomEvent<EmoteDetail>(EMOTE_EVENT, { detail: { key: r.key } }));
    const box = target.getBoundingClientRect();
    const parent = target.closest("section")!.getBoundingClientRect();
    const id = nextId.current++;
    setBursts((b) => [...b.slice(-11), { id, reaction: r, x: box.left - parent.left + box.width / 2 }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 900);
    const ok = await sendReaction(repo, r.key);
    setWarning(!ok);
  }

  const label = (r: Reaction) => `${text.send} ${text.names[r.key]} — ${nickname}`;
  const count = (r: Reaction) => (counts ? fmt.format(counts[r.key]) : "·");

  return (
    <section className={styles.reactions} aria-label={`${text.title} — ${nickname}`}>
      <div className={styles.head}>
        <span className={styles.title}>{text.title}</span>
        <span className={styles.total} aria-live="polite">
          {total === null ? "…" : text.total.replace("{n}", fmt.format(total))}
        </span>
      </div>

      <ul className={styles.list}>
        {regular.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              className={styles.button}
              aria-label={label(r)}
              title={text.names[r.key]}
              onClick={(e) => react(r, e.currentTarget)}
            >
              <span className={styles.emoji} aria-hidden="true">
                {r.emoji}
              </span>
              <span className={styles.count}>{count(r)}</span>
            </button>
          </li>
        ))}
      </ul>

      {exclusive.map((r) => (
        <button
          key={r.key}
          type="button"
          className={`${styles.button} ${styles.exclusive}`}
          aria-label={label(r)}
          title={text.names[r.key]}
          onClick={(e) => react(r, e.currentTarget)}
        >
          <span className={styles.emoji} aria-hidden="true">
            <Glyph r={r} />
          </span>
          <span className={styles.shout}>{(r as { shout?: string }).shout ?? text.names[r.key]}</span>
          <span className={styles.count}>{count(r)}</span>
        </button>
      ))}

      {warning && <p className={styles.warning}>{text.slowDown}</p>}

      <div className={styles.bursts} aria-hidden="true">
        {bursts.map((b) => (
          <span key={b.id} className={styles.burst} style={{ left: b.x }}>
            <Glyph r={b.reaction} size={24} />
          </span>
        ))}
      </div>
    </section>
  );
}
