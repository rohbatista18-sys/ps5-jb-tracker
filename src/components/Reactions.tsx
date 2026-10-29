"use client";

import { useRef, useState } from "react";
import { EMOTE_EVENT, REACTION_QUOTA, reactionsFor, type EmoteDetail, type Reaction, type ReactionKey } from "@/lib/reactions-config";
import { sendReaction, useReactionQuota, useReactions, type SendResult } from "@/hooks/useReactions";
import PixelFlag from "./PixelFlag";
import { isFlagKey } from "./flags";
import styles from "./Reactions.module.css";

// Local copy of the dictionary `fill` helper, so this client component doesn't bundle every dictionary.
const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

interface Props {
  repo: string;
  nickname: string;
  locale: string;
  text: {
    title: string;
    total: string;
    send: string;
    slowDown: string;
    remaining: string;
    quotaReached: string;
    sent: string;
    names: Record<ReactionKey, string>;
  };
}

interface Burst {
  id: number;
  reaction: Reaction;
  x: number;
}

const Glyph = ({ r, size }: { r: Reaction; size?: number }) =>
  isFlagKey(r.key) ? <PixelFlag flag={r.key} size={size} /> : r.emoji;

export default function Reactions({ repo, nickname, locale, text }: Props) {
  const counts = useReactions(repo);
  const quota = useReactionQuota();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [result, setResult] = useState<SendResult | null>(null);
  // Screen-reader feedback only for the card the visitor clicked (the quota is shared by all
  // three cards, so a live region per card would announce every change three times).
  const [announcement, setAnnouncement] = useState("");
  const statusId = `reactions-status-${repo}`;
  const outOfQuota = quota?.remaining === 0;
  const resetTime = quota?.resetAt
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(quota.resetAt))
    : "";
  const nextId = useRef(0);
  const fmt = new Intl.NumberFormat(locale, { notation: "compact" });
  const available = reactionsFor(repo);
  const regular = available.filter((r) => !("only" in r));
  const exclusive = available.filter((r) => "only" in r);
  const total = counts ? available.reduce((sum, r) => sum + counts[r.key], 0) : null;

  async function react(r: Reaction, target: HTMLElement) {
    if (outOfQuota) return;
    window.dispatchEvent(new CustomEvent<EmoteDetail>(EMOTE_EVENT, { detail: { key: r.key } }));
    const box = target.getBoundingClientRect();
    const parent = target.closest("section")!.getBoundingClientRect();
    const id = nextId.current++;
    setBursts((b) => [...b.slice(-11), { id, reaction: r, x: box.left - parent.left + box.width / 2 }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 900);
    const res = await sendReaction(repo, r.key);
    setResult(res);
    setAnnouncement(res === "ok" ? fill(text.sent, { name: text.names[r.key], dev: nickname }) : "");
  }

  const label = (r: Reaction) => `${text.send} ${text.names[r.key]} — ${nickname}`;
  const count = (r: Reaction) => (counts ? fmt.format(counts[r.key]) : "·");

  const status = outOfQuota
    ? { warn: true, msg: fill(text.quotaReached, { max: REACTION_QUOTA, time: resetTime }) }
    : result === "error"
      ? { warn: true, msg: text.slowDown }
      : quota
        ? { warn: false, msg: fill(text.remaining, { n: quota.remaining, max: REACTION_QUOTA }) }
        : null;

  return (
    <section className={styles.reactions} aria-label={`${text.title} — ${nickname}`}>
      <div className={styles.head}>
        <span className={styles.title}>{text.title}</span>
        <span className={styles.total}>
          {total === null ? "…" : fill(text.total, { n: fmt.format(total) })}
        </span>
      </div>

      <ul className={styles.list}>
        {regular.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              className={styles.button}
              disabled={outOfQuota}
              aria-describedby={statusId}
              aria-label={label(r)}
              title={text.names[r.key]}
              onClick={(e) => react(r, e.currentTarget)}
            >
              <span className={styles.emoji} aria-hidden="true">
                <Glyph r={r} />
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
          disabled={outOfQuota}
          aria-describedby={statusId}
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

      <p id={statusId} className={status?.warn ? styles.warning : styles.remaining} hidden={!status}>
        {status?.msg}
      </p>
      <span className="sr-only" role="status">
        {announcement && status ? `${announcement} ${status.msg}` : status?.warn && result ? status.msg : ""}
      </span>

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
