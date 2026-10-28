"use client";

import { useEffect, useRef } from "react";
import { getVisitorId, usePresence } from "@/hooks/usePresence";
import { EMOTE_EVENT, REACTIONS, type EmoteDetail } from "@/lib/reactions-config";
import { SPRITES, rasterize, rasterizeFlagBR, rasterizeLabel } from "./sprites";
import styles from "./PixelCrowd.module.css";

export const MAX_SPRITES = 40;
const TICK_MS = 1000 / 12;
// Feet baselines as a fraction of the stage height (stage sits above the header).
const LANES = [0.7, 0.84, 0.97];
const LANE_ALPHA = [0.65, 0.82, 1];
const SELF_ALPHA = 1;
const POP_S = 0.45;
const FADE_S = 1.6;
const EMOTE_MS = 2200;
const EMOTE_STAGGER_MS = 280;
const EMOTE_PENDING_MAX_MS = 60_000;
const MAX_EMOTES = 8;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

interface Emote {
  emoji: string;
  shout?: string;
  created: number;
  start: number | null; // null until the stage is on screen, so the visitor actually sees it
  jitter: number;
}

type Mode = "walk" | "idle" | "jump";

interface Actor {
  sprite: number;
  palette: number;
  self: boolean;
  x: number;
  lane: number;
  dir: 1 | -1;
  speed: number;
  mode: Mode;
  timer: number;
  jump: number;
  age: number;
  leaving: number;
  phase: number;
}

export interface Crowd {
  setCount(n: number): void;
  emote(emoji: string, shout?: string): void;
  destroy(): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

export function createCrowd(canvas: HTMLCanvasElement, selfSeed: string, selfLabel: string): Crowd {
  const ctx = canvas.getContext("2d")!;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cache = new Map<string, HTMLCanvasElement>();
  const label = rasterizeLabel(selfLabel, "#ffd166");
  const flagBR = rasterizeFlagBR();
  const actors: Actor[] = [];
  const seed = hash(selfSeed);
  let target = 1;
  let W = 0;
  let H = 0;
  let px = 4;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let emotes: Emote[] = [];
  const pixelFont = getComputedStyle(document.documentElement).getPropertyValue("--font-pixel").trim() || "monospace";
  const duration = (e: Emote) => (e.shout ? EMOTE_MS * 1.6 : EMOTE_MS);
  let onScreen = true;
  let staticTimer: ReturnType<typeof setTimeout> | undefined;

  const img = (a: Actor, frame: 0 | 1) => {
    const key = `${a.sprite}:${a.palette}:${frame}:${a.dir}`;
    let c = cache.get(key);
    if (!c) cache.set(key, (c = rasterize(SPRITES[a.sprite], a.palette, frame, a.dir < 0)));
    return c;
  };

  const spawn = (self: boolean, delay: number): Actor => {
    const sprite = self ? seed % SPRITES.length : Math.floor(Math.random() * SPRITES.length);
    return {
      sprite,
      palette: self ? (seed >>> 8) % 4 : Math.floor(Math.random() * 4),
      self,
      x: rand(0.04, 0.9) * W,
      lane: self ? LANES.length - 1 : Math.floor(Math.random() * LANES.length),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(6, 14),
      mode: "walk",
      timer: rand(2, 7),
      jump: 0,
      age: -delay,
      leaving: 0,
      phase: Math.random() < 0.5 ? 0 : 1,
    };
  };

  const reconcile = (instant: boolean) => {
    const present = actors.filter((a) => !a.leaving);
    if (!present.some((a) => a.self)) actors.push(spawn(true, 0));
    let count = present.length + (present.some((a) => a.self) ? 0 : 1);
    for (let i = 0; count < target; count++, i++) actors.push(spawn(false, instant ? 0 : i * 0.12));
    for (let i = present.length - 1; i >= 0 && count > target; i--) {
      const a = present[i];
      if (a.self) continue;
      count--;
      if (instant || a.age < 0) actors.splice(actors.indexOf(a), 1);
      else {
        a.leaving = 1e-6;
        a.mode = "walk";
        a.dir = a.x < W / 2 ? -1 : 1;
      }
    }
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const nextW = Math.round(cssW * dpr);
    if (W) actors.forEach((a) => (a.x *= nextW / W));
    W = canvas.width = nextW;
    H = canvas.height = Math.round(cssH * dpr);
    px = Math.max(2, Math.round((cssW < 640 ? 3 : 4) * dpr));
    ctx.imageSmoothingEnabled = false;
  };

  const update = (dt: number) => {
    clock += dt;
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i];
      a.age += dt;
      if (a.age < 0) continue;
      const w = img(a, 0).width * px;
      if (a.leaving) {
        a.leaving += dt;
        a.x += a.dir * a.speed * 2.5 * px * dt;
        if (a.leaving > FADE_S || a.x < -w || a.x > W) actors.splice(i, 1);
        continue;
      }
      a.timer -= dt;
      if (a.mode === "walk") {
        a.x += a.dir * a.speed * px * dt;
        if (a.x < 0 || a.x > W - w) {
          a.x = Math.min(Math.max(a.x, 0), W - w);
          a.dir = a.dir > 0 ? -1 : 1;
        }
      } else if (a.mode === "jump") {
        a.jump += dt / 0.6;
        a.x += a.dir * a.speed * 0.6 * px * dt;
        if (a.jump >= 1) a.timer = 0;
      }
      if (a.timer <= 0) {
        const r = Math.random();
        a.jump = 0;
        if (a.mode !== "walk") {
          a.mode = "walk";
          a.timer = rand(3, 8);
          if (r < 0.35) a.dir = a.dir > 0 ? -1 : 1;
        } else if (r < 0.2) {
          a.mode = "jump";
          a.timer = 1;
        } else {
          a.mode = "idle";
          a.timer = rand(1, 3.5);
        }
      }
    }
  };

  // Emojis the visitor sent rise above their own sprite and fade out.
  const drawEmotes = (x: number, top: number, animated: boolean) => {
    const now = performance.now();
    let nextStart = now;
    for (const e of emotes) {
      if (e.start === null && onScreen) {
        e.start = Math.max(nextStart, now);
        nextStart = e.start + EMOTE_STAGGER_MS;
      } else if (e.start !== null) nextStart = Math.max(nextStart, e.start + EMOTE_STAGGER_MS);
    }
    emotes = emotes.filter((e) =>
      e.start === null ? now - e.created < EMOTE_PENDING_MAX_MS : now - e.start < duration(e),
    );
    const size = 7 * px;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (const e of emotes) {
      if (e.start === null || e.start > now) continue;
      const t = (now - e.start) / duration(e);
      const rise = animated ? Math.round(t * 4) * px : 0; // rises in whole pixel steps, 8-bit style
      const scale = animated && t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1;
      ctx.globalAlpha = animated ? (t < 0.1 ? t / 0.1 : t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1) : 1;
      ctx.save();
      ctx.translate(x + e.jitter * px, top - rise);
      ctx.scale(scale, scale);
      if (e.emoji === "🇧🇷") {
        const cell = Math.max(1, Math.round(px / 2));
        const fw = flagBR.width * cell;
        const fh = flagBR.height * cell;
        ctx.drawImage(flagBR, -fw / 2, -fh, fw, fh);
      } else ctx.fillText(e.emoji, 0, 0);
      ctx.restore();
      if (e.shout) drawShout(e.shout, x + e.jitter * px, top - rise - size / 2, (size * scale) / 2);
      ctx.font = `${size}px ${EMOJI_FONT}`;
    }
    ctx.globalAlpha = 1;
  };

  // Pixel speech bubble in the page's pixel font, beside the emoji (right side, or left if it
  // would not fit), clamped inside the stage.
  const drawShout = (text: string, x: number, cy: number, half: number) => {
    const fs = 2 * px;
    ctx.font = `${fs}px ${pixelFont}, monospace`;
    const pad = 2 * px;
    const tw = Math.ceil(ctx.measureText(text).width);
    const bw = tw + pad * 2;
    const bh = fs + pad * 2;
    const right = x + half + 2 * px;
    const left = x - half - 2 * px - bw;
    const rawX = right + bw + px <= W ? right : left >= px ? left : (W - bw) / 2;
    const bx = Math.round(Math.min(Math.max(rawX, px), W - bw - px) / px) * px;
    const by = Math.max(px, Math.round((cy - bh / 2) / px) * px);
    ctx.fillStyle = "#009c3b";
    ctx.fillRect(bx - px, by - px, bw + 2 * px, bh + 2 * px);
    ctx.fillStyle = "#0b0b14";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#ffdf00";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, bx + pad, by + pad);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
  };

  const draw = (animated: boolean) => {
    ctx.clearRect(0, 0, W, H);
    const order = actors.filter((a) => a.age >= 0).sort((a, b) => a.lane - b.lane || Number(a.self) - Number(b.self));
    for (const a of order) {
      const walking = animated && a.mode === "walk";
      const frame = (walking ? (Math.floor(clock * 6) + a.phase) % 2 : 0) as 0 | 1;
      const sprite = img(a, frame);
      const pop = animated && a.age < POP_S ? easeOutBack(a.age / POP_S) : 1;
      const w = Math.max(1, Math.round(sprite.width * pop)) * px;
      const h = Math.max(1, Math.round(sprite.height * pop)) * px;
      const base = Math.round((H * LANES[a.lane]) / px) * px;
      const hop = a.mode === "jump" ? Math.round(Math.sin(Math.PI * Math.min(a.jump, 1)) * 6) * px : 0;
      const cx = Math.round(a.x / px) * px + Math.round((sprite.width * px - w) / 2 / px) * px;
      const alpha = (a.self ? SELF_ALPHA : LANE_ALPHA[a.lane]) * (a.leaving ? Math.max(0, 1 - a.leaving / FADE_S) : 1);

      ctx.globalAlpha = alpha * 0.5 * (hop ? 0.6 : 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(cx + px, base, w - 2 * px, px);

      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, cx, base - h - hop, w, h);

      if (a.self && pop === 1) {
        const lp = Math.max(1, Math.round(px / 2));
        const lx = cx + Math.round((w - label.width * lp) / 2);
        const ly = base - h - hop - 9 * lp;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(label, lx, ly, label.width * lp, label.height * lp);
        ctx.fillStyle = "#ffd166";
        const ax = lx + Math.floor(label.width / 2) * lp;
        ctx.fillRect(ax - lp, ly + 6 * lp, 3 * lp, lp);
        ctx.fillRect(ax, ly + 7 * lp, lp, lp);
      }

      if (a.self && pop === 1) drawEmotes(cx + w / 2, base - h - hop - 12 * Math.max(1, Math.round(px / 2)), animated);

      if (animated && a.age < POP_S) {
        const t = a.age / POP_S;
        const r = (4 + t * 10) * px;
        const mx = cx + w / 2;
        const my = base - (sprite.height * px) / 2;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = "#ffd166";
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          ctx.fillRect(Math.round((mx + Math.cos(ang) * r) / px) * px, Math.round((my + Math.sin(ang) * r) / px) * px, px, px);
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < TICK_MS) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    update(dt);
    draw(true);
  };

  const start = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (motionQuery.matches) {
      reconcile(true);
      draw(false);
    } else if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const onResize = () => {
    resize();
    if (!raf) draw(false);
  };

  resize();
  reconcile(true);
  actors.forEach((a) => (a.age = 0));
  start();

  // Static (reduced-motion) mode has no loop: redraw when an emote appears and once it expires.
  const redrawStatic = () => {
    if (raf) return;
    draw(false);
    clearTimeout(staticTimer);
    if (emotes.length) staticTimer = setTimeout(redrawStatic, EMOTE_MS);
  };

  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) redrawStatic();
  });
  observer.observe(canvas);

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", start);
  motionQuery.addEventListener("change", start);

  return {
    setCount(n) {
      target = Math.max(1, Math.min(MAX_SPRITES, Math.floor(n)));
      reconcile(motionQuery.matches);
      if (!raf) draw(false);
    },
    emote(emoji, shout) {
      const e: Emote = { emoji, shout, created: performance.now(), start: null, jitter: shout ? 0 : Math.round(rand(-3, 3)) };
      emotes = [...emotes, e].slice(-MAX_EMOTES);
      redrawStatic();
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(staticTimer);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      motionQuery.removeEventListener("change", start);
    },
  };
}

interface Props {
  onlineLabel: string;
  youLabel: string;
  visitsLabel: string;
  visitsShortLabel: string;
}

export default function PixelCrowd({ onlineLabel, youLabel, visitsLabel, visitsShortLabel }: Props) {
  const { online, visits } = usePresence();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crowdRef = useRef<Crowd | null>(null);

  useEffect(() => {
    const crowd = createCrowd(canvasRef.current!, getVisitorId(), youLabel);
    crowdRef.current = crowd;
    return () => crowd.destroy();
  }, [youLabel]);

  useEffect(() => {
    crowdRef.current?.setCount(online ?? 1);
  }, [online]);

  useEffect(() => {
    const onEmote = (e: Event) => {
      const detail = (e as CustomEvent<Partial<EmoteDetail> | null>).detail;
      const r = REACTIONS.find((x) => x.key === detail?.key);
      if (r) crowdRef.current?.emote(r.emoji, "shout" in r ? r.shout : undefined);
    };
    window.addEventListener(EMOTE_EVENT, onEmote);
    return () => window.removeEventListener(EMOTE_EVENT, onEmote);
  }, []);

  const extra = online !== null && online > MAX_SPRITES ? online - MAX_SPRITES : 0;

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.hud} role="status" aria-live="polite">
        <span className={styles.dot} aria-hidden="true">
          ●
        </span>
        <span>
          {online ?? "…"} {onlineLabel}
        </span>
        {extra > 0 && <span className={styles.extra}>+{extra}</span>}
        {visits !== null && visits > 0 && (
          <span className={styles.visits}>
            <span className={styles.visitsLong}>{visitsLabel.replace("{n}", visits.toLocaleString())}</span>
            <span className={styles.visitsShort}>{visitsShortLabel.replace("{n}", new Intl.NumberFormat(undefined, { notation: "compact" }).format(visits))}</span>
          </span>
        )}
      </div>
    </>
  );
}
