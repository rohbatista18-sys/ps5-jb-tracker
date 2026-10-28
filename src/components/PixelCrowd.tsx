"use client";

import { useEffect, useRef } from "react";
import { getVisitorId, usePresence } from "@/hooks/usePresence";
import { SPRITES, rasterize, rasterizeLabel } from "./sprites";
import styles from "./PixelCrowd.module.css";

export const MAX_SPRITES = 40;
const TICK_MS = 1000 / 12;
// Feet baselines as a fraction of the stage height (stage sits above the header).
const LANES = [0.7, 0.84, 0.97];
const LANE_ALPHA = [0.65, 0.82, 1];
const SELF_ALPHA = 1;
const POP_S = 0.45;
const FADE_S = 1.6;

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
  const actors: Actor[] = [];
  const seed = hash(selfSeed);
  let target = 1;
  let W = 0;
  let H = 0;
  let px = 4;
  let raf = 0;
  let last = 0;
  let clock = 0;

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

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", start);
  motionQuery.addEventListener("change", start);

  return {
    setCount(n) {
      target = Math.max(1, Math.min(MAX_SPRITES, Math.floor(n)));
      reconcile(motionQuery.matches);
      if (!raf) draw(false);
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      motionQuery.removeEventListener("change", start);
    },
  };
}

export default function PixelCrowd({ onlineLabel, youLabel }: { onlineLabel: string; youLabel: string }) {
  const { online } = usePresence();
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
      </div>
    </>
  );
}
