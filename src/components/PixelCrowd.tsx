"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { getVisitorId, usePresence } from "@/hooks/usePresence";
import { useLiveSalves } from "@/hooks/useLiveSalves";
import { EMOTE_EVENT, REACTIONS, type EmoteDetail } from "@/lib/reactions-config";
import { SPRITES, SPRITE_HEIGHT, rasterize, rasterizeFlagBR, rasterizeLabel } from "./sprites";
import { DEPTH_ALPHA, DEPTH_SCALE, createScenery, type Platform, type Scenery } from "./scenery";
import styles from "./PixelCrowd.module.css";

export const MAX_SPRITES = 40;
const TICK_MS = 1000 / 12;
// Backing-store cap (device px): a 4K screen renders at a lower density instead of allocating ~33 MB.
const MAX_BUFFER_PX = 2560 * 1600;
// One shared world: every visitor sees the same scenery for a given viewport size.
const SCENERY_SEED = 1410;
const POP_S = 0.45;
const FADE_S = 1.6;
const HOP_S = 0.8;
const HOP_CHANCE = 0.06;
// Room (in sprite cells) the own sprite needs above its feet for the label and rising emotes.
const SELF_HEADROOM = SPRITE_HEIGHT + 30;
// Horizontal room (in cells, from the sprite's left edge) for the sprite, emoji and a wrapped
// shout bubble, plus margins. The own sprite blends into the scenery only where this fits
// entirely inside the free left gutter; otherwise it moves to the corner overlay.
const SELF_FOOT_L = 3;
const SELF_FOOT_R = 48;
// Corner overlay, in cells of OVERLAY_CSS_PX CSS px (42 x 46 cells = 126 x 138 CSS px).
const OVERLAY_CSS_PX = 3;
const OVERLAY_COLS = 42;
const LEDGE_COLS = 16;
const LEDGE_ROWS = 9;
const OVERLAY_ROWS = LEDGE_ROWS + SPRITE_HEIGHT + 20;
const OVERLAY_SPRITE_X = 2;
const OVERLAY_GAP_CSS = 8;
const EMOTE_MS = 2200;
const EMOTE_STAGGER_MS = 280;
const EMOTE_PENDING_MAX_MS = 60_000;
const MAX_EMOTES = 8;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const PALETTES = 4;

// Near-ledge colors from scenery.ts, so the overlay ledge matches the scene.
const LEDGE_TOP = "#3a3a7c";
const LEDGE_BODY = "#222249";
const LEDGE_DARK = "#15152f";
const LEDGE_SPARK = "#ff3ea5";
const SCENE_BLUE = "#0070d1";
const SCENE_BLUE_HI = "#5aa9ff";
const GRASS = "#2a7a6a";
const GRASS_DARK = "#1f5a5a";

interface Emote {
  emoji: string;
  shout?: string;
  created: number;
  start: number | null; // null until the page is visible, so the visitor actually sees it
  jitter: number;
  // Shout wrapped for the surface it is drawn on (recomputed only when the width changes).
  lines: string[];
  wrapKey: number;
  lineW: number;
}

type Mode = "walk" | "idle" | "jump" | "hop";

interface Actor {
  sprite: number;
  palette: number;
  self: boolean;
  x: number; // left edge, device px
  plat: number;
  dir: 1 | -1;
  speed: number; // sprite cells per second
  mode: Mode;
  timer: number;
  jump: number;
  age: number;
  leaving: number;
  phase: number;
  // Derived from the platform (refreshed by fit()).
  cell: number;
  w: number;
  h: number;
  lo: number;
  hi: number;
  // Hop between platforms.
  hx0: number;
  hx1: number;
  hy1: number;
  hplat: number;
}

/** A canvas the own sprite's label, emotes and shout can be drawn on. */
interface Surface {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  px: number;
  left: number; // emotes and the shout stay between left and right
  right: number;
  emojiFont: string;
  shoutFont: string;
}

export interface Crowd {
  setCount(n: number): void;
  emote(emoji: string, shout?: string): void;
  /** A salve another visitor sent, shown above one of the other sprites in view. */
  emoteOther(emoji: string, shout?: string): void;
  destroy(): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

/** The overlay's small floating ledge, in the near-ledge style of scenery.ts (1 px per cell). */
function rasterizeLedge(): { back: HTMLCanvasElement; front: HTMLCanvasElement } {
  const back = document.createElement("canvas");
  back.width = LEDGE_COLS;
  back.height = LEDGE_ROWS;
  const b = back.getContext("2d")!;
  const dot = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  dot(b, 2, 4, LEDGE_COLS - 4, 1, SCENE_BLUE, 0.11);
  dot(b, 1, 0, LEDGE_COLS - 2, 1, LEDGE_TOP);
  dot(b, 0, 1, LEDGE_COLS, 2, LEDGE_BODY);
  dot(b, 1, 3, LEDGE_COLS - 2, 1, LEDGE_DARK);
  for (const x of [3, 8, 12]) dot(b, x, 0, 1, 1, SCENE_BLUE_HI, 0.34);
  for (const x of [2, 5, 9, 12]) dot(b, x, 1 + (x % 2), 1, 1, LEDGE_DARK);
  dot(b, 3, 4, 10, 1, LEDGE_DARK);
  dot(b, 5, 5, 7, 1, LEDGE_DARK);
  dot(b, 7, 6, 3, 1, LEDGE_DARK);
  dot(b, 6, 4, 1, 1, LEDGE_BODY);
  dot(b, 9, 5, 1, 1, LEDGE_BODY);
  dot(b, 6, 7, 1, 1, LEDGE_SPARK, 0.34);
  dot(b, 10, 7, 1, 2, LEDGE_SPARK, 0.34);
  b.globalAlpha = 1;

  // Grass tufts drawn over the sprite's feet, 2 rows above the ledge top.
  const front = document.createElement("canvas");
  front.width = LEDGE_COLS;
  front.height = 2;
  const f = front.getContext("2d")!;
  dot(f, 1, 0, 1, 2, GRASS, 0.6);
  dot(f, 2, 1, 1, 1, GRASS_DARK, 0.5);
  dot(f, 13, 1, 1, 1, GRASS, 0.6);
  dot(f, 14, 0, 1, 2, GRASS, 0.6);
  f.globalAlpha = 1;
  return { back, front };
}

export function createCrowd(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  selfSeed: string,
  selfLabel: string,
  hud: HTMLElement | null,
): Crowd {
  const ctx = canvas.getContext("2d")!;
  const octx = overlay.getContext("2d")!;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cache: (HTMLCanvasElement | undefined)[] = [];
  const label = rasterizeLabel(selfLabel, "#ffd166");
  const flagBR = rasterizeFlagBR();
  const ledge = rasterizeLedge();
  const actors: Actor[] = [];
  const order: Actor[] = [];
  const emotes: Emote[] = [];
  // Salves from other visitors: above a visible sprite (a) or, if none is in view, a visible ledge.
  const others: { a: Actor | null; x: number; top: number; e: Emote }[] = [];
  const load: number[] = [];
  const seed = hash(selfSeed);
  const pixelFont = getComputedStyle(document.documentElement).getPropertyValue("--font-pixel").trim() || "monospace";
  const mainSurf: Surface = { ctx, W: 0, H: 0, px: 4, left: 0, right: 0, emojiFont: "", shoutFont: "" };
  const overSurf: Surface = { ctx: octx, W: 0, H: 0, px: 3, left: 0, right: 0, emojiFont: "", shoutFont: "" };
  const otherSurf: Surface = { ctx, W: 0, H: 0, px: 4, left: 0, right: 0, emojiFont: "", shoutFont: "" };
  let target = 1;
  let W = 0;
  let H = 0;
  let visH = 0; // device px always visible from the top, even with mobile toolbars shown
  let cssW = 0;
  let ratio = 1; // device px per CSS px
  let px = 4;
  let scenery: Scenery | null = null;
  let plats: Platform[] = [];
  let gutter = 0; // right edge of the free left gutter, device px
  let useOverlay = true;
  let raf = 0;
  let resizeRaf = 0;
  let last = 0;
  let clock = 0;
  const duration = (e: Emote) => (e.shout ? EMOTE_MS * 1.6 : EMOTE_MS);
  let staticTimer: ReturnType<typeof setTimeout> | undefined;

  const img = (a: Actor, frame: 0 | 1) => {
    const key = ((a.sprite * PALETTES + a.palette) * 2 + frame) * 2 + (a.dir < 0 ? 1 : 0);
    let c = cache[key];
    if (!c) cache[key] = c = rasterize(SPRITES[a.sprite], a.palette, frame, a.dir < 0);
    return c;
  };

  const cellFor = (depth: number) => Math.max(1, Math.round(px * DEPTH_SCALE[depth]));
  const width = (p: Platform) => p.x1 - p.x0;

  /** Refreshes the actor's size and walkable range from its platform (or the overlay). */
  const fit = (a: Actor) => {
    const s = img(a, 0);
    if (a.self && useOverlay) {
      a.cell = overSurf.px;
      a.w = s.width * a.cell;
      a.h = s.height * a.cell;
      a.x = a.lo = a.hi = OVERLAY_SPRITE_X * a.cell; // stands on the ledge; idles and jumps
      return;
    }
    const p = plats[a.plat];
    a.cell = cellFor(p.depth);
    a.w = s.width * a.cell;
    a.h = s.height * a.cell;
    a.lo = p.x0;
    a.hi = Math.max(p.x0, p.x1 - a.w);
    if (a.self) {
      // Sprite, emotes and shout must all stay inside the free gutter.
      a.lo = Math.max(a.lo, SELF_FOOT_L * a.cell);
      a.hi = Math.max(a.lo, Math.min(a.hi, gutter - SELF_FOOT_R * a.cell));
    }
    a.x = clamp(a.x, a.lo, a.hi);
  };

  /** Free left gutter: left of every content block (in-flow, non-fixed) of the page. */
  const measureGutter = () => {
    const main = document.querySelector("main");
    let left = main ? main.getBoundingClientRect().left : (cssW - 1240) / 2;
    const root = main?.parentElement;
    if (root) {
      const els = root.querySelectorAll(":scope > *, main > *, main > * > *");
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (!r.width || !r.height || r.left >= left) continue;
        if (getComputedStyle(els[i]).position === "fixed") continue;
        left = r.left;
      }
    }
    gutter = Math.max(0, left) * ratio;
  };

  /** A near platform where the whole own-sprite footprint fits in the gutter, or -1. */
  const pickSelfPlatform = (a: Actor) => {
    if (cssW < 640) return -1;
    const c = cellFor(2);
    const sw = img(a, 0).width * c;
    let best = -1;
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      if (p.depth !== 2) continue;
      const lo = Math.max(p.x0, SELF_FOOT_L * c);
      const hi = Math.min(p.x1 - sw, gutter - SELF_FOOT_R * c);
      if (hi < lo || p.y > visH - 2 * c || p.y - SELF_HEADROOM * c < 0) continue;
      if (best < 0 || p.y > plats[best].y) best = i;
    }
    return best;
  };

  /** Size and place the corner overlay: bottom-left, clear of the HUD, inside 100svh. */
  const layoutOverlay = () => {
    const dpr = window.devicePixelRatio || 1;
    const c = Math.max(2, Math.round(OVERLAY_CSS_PX * dpr));
    const ow = OVERLAY_COLS * c;
    const oh = OVERLAY_ROWS * c;
    if (overlay.width !== ow || overlay.height !== oh) {
      overlay.width = ow;
      overlay.height = oh;
    }
    overlay.style.width = `${ow / dpr}px`;
    overlay.style.height = `${oh / dpr}px`;
    // Stack above the HUD when it reaches under the overlay (narrow screens).
    const r = hud?.getBoundingClientRect();
    const lift = r && r.width && r.left < 12 + ow / dpr + OVERLAY_GAP_CSS ? Math.ceil(r.height) + OVERLAY_GAP_CSS : 0;
    overlay.style.bottom = `calc(max(12px, env(safe-area-inset-bottom)) + ${lift}px)`;
    overlay.style.display = useOverlay ? "block" : "none";
    octx.imageSmoothingEnabled = false;
    overSurf.W = overSurf.right = ow;
    overSurf.H = oh;
    overSurf.px = c;
    overSurf.emojiFont = `${7 * c}px ${EMOJI_FONT}`;
    overSurf.shoutFont = `${2 * c}px ${pixelFont}, monospace`;
  };

  /** Decide where the own sprite lives (gutter platform or corner overlay) and fit it there. */
  const assignSelf = (a: Actor) => {
    const p = pickSelfPlatform(a);
    useOverlay = p < 0;
    if (!useOverlay) a.plat = p;
    layoutOverlay();
    mainSurf.right = Math.max(0, gutter - 2 * px);
    fit(a);
  };

  const placeSelf = () => {
    measureGutter();
    for (let i = 0; i < actors.length; i++) if (actors[i].self) assignSelf(actors[i]);
  };

  const recount = () => {
    load.length = plats.length;
    load.fill(0);
    for (const a of actors) if (!a.leaving && !(a.self && useOverlay)) load[a.plat] += a.self ? 3 : 1;
  };

  /** Least-populated platform relative to its length, so the crowd scatters instead of clumping. */
  const pickPlatform = (a: Actor) => {
    const sw = img(a, 0).width;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < plats.length; i++) {
      const cap = width(plats[i]) / (sw * cellFor(plats[i].depth) * 3);
      if (cap < 0.5) continue;
      const score = (load[i] + 0.5) / cap + Math.random() * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best < 0 ? Math.floor(Math.random() * plats.length) : best;
  };

  const spawn = (self: boolean, delay: number): Actor => {
    const a: Actor = {
      sprite: self ? seed % SPRITES.length : Math.floor(Math.random() * SPRITES.length),
      palette: self ? (seed >>> 8) % PALETTES : Math.floor(Math.random() * PALETTES),
      self,
      x: 0,
      plat: 0,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(6, 14),
      mode: "walk",
      timer: rand(2, 7),
      jump: 0,
      age: -delay,
      leaving: 0,
      phase: Math.random() < 0.5 ? 0 : 1,
      cell: 1,
      w: 0,
      h: 0,
      lo: 0,
      hi: 0,
      hx0: 0,
      hx1: 0,
      hy1: 0,
      hplat: 0,
    };
    if (self) {
      assignSelf(a);
      a.x = a.lo + (a.hi - a.lo) * 0.25;
      if (!useOverlay) load[a.plat] += 3;
    } else {
      a.plat = pickPlatform(a);
      load[a.plat] += 1;
      fit(a);
      a.x = a.lo + (a.hi - a.lo) * Math.random();
    }
    return a;
  };

  const reconcile = (instant: boolean) => {
    recount();
    const present = actors.filter((a) => !a.leaving);
    const hasSelf = present.some((a) => a.self);
    if (!hasSelf) actors.push(spawn(true, 0));
    let count = present.length + (hasSelf ? 0 : 1);
    for (let i = 0; count < target; count++, i++) actors.push(spawn(false, instant ? 0 : i * 0.12));
    for (let i = present.length - 1; i >= 0 && count > target; i--) {
      const a = present[i];
      if (a.self) continue;
      count--;
      if (instant || a.age < 0 || a.mode === "hop") actors.splice(actors.indexOf(a), 1);
      else {
        // Walk off toward the nearer end of the platform while fading out.
        a.leaving = 1e-6;
        a.mode = "walk";
        a.dir = a.x - a.lo < a.hi - a.x ? -1 : 1;
      }
    }
  };

  const resize = () => {
    cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    ratio = Math.min(dpr, Math.sqrt(MAX_BUFFER_PX / Math.max(1, cssW * cssH)));
    const nextW = Math.max(1, Math.round(cssW * ratio));
    const nextH = Math.max(1, Math.round(cssH * ratio));
    const nextPx = Math.max(2, Math.round((cssW < 640 ? 3 : 4) * ratio));
    // Mobile toolbars fire resize without changing the (100lvh) canvas: keep the scene.
    if (scenery && nextW === W && nextH === H && nextPx === px) {
      placeSelf();
      return;
    }
    if (nextW !== W || nextH !== H) {
      W = canvas.width = nextW;
      H = canvas.height = nextH;
    }
    px = nextPx;
    // Smallest viewport height (toolbars shown), so the own sprite never hides under them.
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    visH = Math.min(H, (probe.getBoundingClientRect().height || cssH) * ratio);
    probe.remove();
    mainSurf.W = W;
    mainSurf.H = H;
    mainSurf.px = px;
    mainSurf.emojiFont = `${7 * px}px ${EMOJI_FONT}`;
    mainSurf.shoutFont = `${2 * px}px ${pixelFont}, monospace`;
    otherSurf.W = otherSurf.right = W;
    otherSurf.H = H;
    otherSurf.px = px;
    otherSurf.emojiFont = mainSurf.emojiFont;
    otherSurf.shoutFont = mainSurf.shoutFont;
    ctx.imageSmoothingEnabled = false;

    // Relative position on the old platform survives the rebuild.
    for (const a of actors) a.jump = a.hi > a.lo ? (a.x - a.lo) / (a.hi - a.lo) : 0.5;
    scenery = createScenery(W, H, px, SCENERY_SEED);
    plats = scenery.platforms.length ? scenery.platforms : [{ x0: 0, x1: W, y: H - 2 * px, depth: 2 }];
    measureGutter();
    for (const a of actors) {
      const rel = a.jump;
      if (a.mode === "hop") a.mode = "idle";
      a.jump = 0;
      if (a.self) assignSelf(a);
      else {
        a.plat %= plats.length;
        fit(a);
      }
      a.x = a.lo + (a.hi - a.lo) * rel;
    }
    recount();
  };

  /** A random same-depth platform within a short jump, or -1. */
  const findHop = (a: Actor) => {
    const p = plats[a.plat];
    let pick = -1;
    let seen = 0;
    for (let i = 0; i < plats.length; i++) {
      const q = plats[i];
      if (i === a.plat || q.depth !== p.depth || width(q) < a.w * 1.5) continue;
      if (Math.abs(q.y - p.y) > 28 * a.cell) continue;
      const gap = q.x0 > p.x1 ? q.x0 - p.x1 : p.x0 > q.x1 ? p.x0 - q.x1 : 0;
      if (gap > 24 * a.cell) continue;
      if (Math.random() * ++seen < 1) pick = i;
    }
    return pick;
  };

  const startHop = (a: Actor, i: number) => {
    const q = plats[i];
    a.mode = "hop";
    a.jump = 0;
    a.hplat = i;
    a.hx0 = a.x;
    a.hx1 = clamp(a.x + ((q.x0 + q.x1) / 2 > a.x ? 8 : -8) * a.cell, q.x0, Math.max(q.x0, q.x1 - a.w));
    a.hy1 = q.y;
    a.dir = a.hx1 >= a.x ? 1 : -1;
  };

  const update = (dt: number) => {
    clock += dt;
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i];
      a.age += dt;
      if (a.age < 0) continue;
      if (a.leaving) {
        a.leaving += dt;
        a.x = clamp(a.x + a.dir * a.speed * 2.5 * a.cell * dt, a.lo, a.hi);
        if (a.leaving > FADE_S) actors.splice(i, 1);
        continue;
      }
      a.timer -= dt;
      if (a.mode === "walk") {
        if (a.hi - a.lo < 2 * a.cell) a.timer = Math.min(a.timer, 0);
        a.x += a.dir * a.speed * a.cell * dt;
        if (a.x < a.lo || a.x > a.hi) {
          a.x = clamp(a.x, a.lo, a.hi);
          a.dir = a.dir > 0 ? -1 : 1;
        }
      } else if (a.mode === "jump") {
        a.jump += dt / 0.6;
        a.x = clamp(a.x + a.dir * a.speed * 0.6 * a.cell * dt, a.lo, a.hi);
        if (a.jump >= 1) a.timer = 0;
      } else if (a.mode === "hop") {
        a.jump += dt / HOP_S;
        const t = Math.min(a.jump, 1);
        a.x = a.hx0 + (a.hx1 - a.hx0) * t;
        if (t < 1) continue;
        a.plat = a.hplat;
        fit(a);
        a.mode = "idle";
        a.jump = 0;
        a.timer = rand(0.6, 1.5);
        continue;
      }
      if (a.timer <= 0) {
        const r = Math.random();
        a.jump = 0;
        if (a.mode !== "walk") {
          a.mode = "walk";
          a.timer = rand(3, 8);
          if (r < 0.35) a.dir = a.dir > 0 ? -1 : 1;
        } else if (r < HOP_CHANCE && !a.self) {
          const to = findHop(a);
          if (to >= 0) startHop(a, to);
          else {
            a.mode = "idle";
            a.timer = rand(1, 3.5);
          }
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

  /** Feet baseline in device px; a hop follows a parabola between the two platforms. */
  const baseOf = (a: Actor) => {
    const y0 = plats[a.plat].y;
    if (a.mode !== "hop") return y0;
    const t = Math.min(a.jump, 1);
    const arc = Math.abs(a.hy1 - y0) / 2 + 8 * a.cell;
    return Math.round(((1 - t) * y0 + t * a.hy1 - 4 * arc * t * (1 - t)) / a.cell) * a.cell;
  };

  // Far to near; higher platforms first within a depth; the own sprite on top.
  const before = (a: Actor, b: Actor) => {
    const da = plats[a.plat].depth;
    const db = plats[b.plat].depth;
    if (da !== db) return da < db;
    if (a.self !== b.self) return b.self;
    return plats[a.plat].y < plats[b.plat].y;
  };

  // Emojis the visitor sent rise above their own sprite and fade out.
  const drawEmotes = (s: Surface, x: number, top: number, animated: boolean) => {
    const now = performance.now();
    let nextStart = now;
    for (let i = 0; i < emotes.length; i++) {
      const e = emotes[i];
      if (e.start === null && !document.hidden) {
        e.start = Math.max(nextStart, now);
        nextStart = e.start + EMOTE_STAGGER_MS;
      } else if (e.start !== null) nextStart = Math.max(nextStart, e.start + EMOTE_STAGGER_MS);
    }
    let n = 0;
    for (let i = 0; i < emotes.length; i++) {
      const e = emotes[i];
      if (e.start === null ? now - e.created < EMOTE_PENDING_MAX_MS : now - e.start < duration(e)) emotes[n++] = e;
    }
    emotes.length = n;
    for (let i = 0; i < emotes.length; i++) paintEmote(s, emotes[i], now, x, top, animated);
  };

  const paintEmote = (s: Surface, e: Emote, now: number, x: number, top: number, animated: boolean) => {
    const c = s.ctx;
    const p = s.px;
    const size = 7 * p;
    c.font = s.emojiFont;
    c.textAlign = "center";
    c.textBaseline = "bottom";
    if (e.start === null || e.start > now) return;
    {
      const t = (now - e.start) / duration(e);
      const rise = animated ? Math.round(t * 4) * p : 0; // rises in whole pixel steps, 8-bit style
      const scale = animated && t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1;
      const ex = clamp(x + e.jitter * p, s.left + size / 2, s.right - size / 2);
      const ey = Math.max(size + p, top - rise);
      c.globalAlpha = animated ? (t < 0.1 ? t / 0.1 : t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1) : 1;
      c.save();
      c.translate(ex, ey);
      c.scale(scale, scale);
      if (e.emoji === "🇧🇷") {
        const cell = Math.max(1, Math.round(p / 2));
        const fw = flagBR.width * cell;
        const fh = flagBR.height * cell;
        c.drawImage(flagBR, -fw / 2, -fh, fw, fh);
      } else c.fillText(e.emoji, 0, 0);
      c.restore();
      if (e.shout) drawShout(s, e, e.shout, ex, ey - size / 2, (size * scale) / 2);
      c.font = s.emojiFont;
    }
    c.globalAlpha = 1;
  };

  /** Greedy word wrap to maxW, cached on the emote until the width or font size changes. */
  const wrap = (s: Surface, e: Emote, text: string, maxW: number) => {
    const key = Math.round(maxW) * 1000 + s.px;
    if (e.wrapKey === key) return;
    e.wrapKey = key;
    e.lines = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && s.ctx.measureText(next).width > maxW) {
        e.lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) e.lines.push(line);
    e.lineW = 0;
    for (const l of e.lines) e.lineW = Math.max(e.lineW, Math.ceil(s.ctx.measureText(l).width));
  };

  // Pixel speech bubble in the page's pixel font, beside the emoji (right side, or left if it
  // would not fit), wrapped to the room available and clamped inside the surface.
  const drawShout = (s: Surface, e: Emote, text: string, x: number, cy: number, half: number) => {
    const c = s.ctx;
    const p = s.px;
    const fs = 2 * p;
    c.font = s.shoutFont;
    const pad = 2 * p;
    const right = x + half + 2 * p;
    const roomR = s.right - right - 2 * pad - 2 * p;
    const roomL = x - half - 2 * p - 2 * pad - 2 * p - s.left;
    wrap(s, e, text, Math.max(roomR, roomL, 6 * fs));
    const n = e.lines.length;
    const bw = e.lineW + pad * 2;
    const bh = n * fs + (n - 1) * p + pad * 2;
    const left = x - half - 2 * p - bw;
    const rawX = right + bw + p <= s.right ? right : left >= s.left + p ? left : (s.left + s.right - bw) / 2;
    const bx = Math.round(clamp(rawX, s.left + 2 * p, s.right - bw - 2 * p) / p) * p;
    const by = Math.round(clamp(cy - bh / 2, 2 * p, s.H - bh - 2 * p) / p) * p;
    c.fillStyle = "#009c3b";
    c.fillRect(bx - p, by - p, bw + 2 * p, bh + 2 * p);
    c.fillStyle = "#0b0b14";
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "#ffdf00";
    c.textAlign = "left";
    c.textBaseline = "top";
    for (let i = 0; i < n; i++) c.fillText(e.lines[i], bx + pad, by + pad + i * (fs + p));
    c.textAlign = "center";
    c.textBaseline = "bottom";
  };

  /** YOU label above the own sprite, then its emotes. */
  const drawSelfExtras = (s: Surface, x: number, w: number, top: number, animated: boolean) => {
    const c = s.ctx;
    const lp = Math.max(1, Math.round(s.px / 2));
    const lx = x + Math.round((w - label.width * lp) / 2);
    const ly = top - 9 * lp;
    c.globalAlpha = 0.95;
    c.drawImage(label, lx, ly, label.width * lp, label.height * lp);
    c.fillStyle = "#ffd166";
    const ax = lx + Math.floor(label.width / 2) * lp;
    c.fillRect(ax - lp, ly + 6 * lp, 3 * lp, lp);
    c.fillRect(ax, ly + 7 * lp, lp, lp);
    c.globalAlpha = 1;
    drawEmotes(s, x + w / 2, top - 12 * lp, animated);
  };

  const frameOf = (a: Actor, animated: boolean) =>
    (animated && a.mode === "walk" ? (Math.floor(clock * 6) + a.phase) % 2 : 0) as 0 | 1;

  const jumpOffset = (a: Actor) => (a.mode === "jump" ? Math.round(Math.sin(Math.PI * Math.min(a.jump, 1)) * 6) * a.cell : 0);

  /** The own sprite on its little ledge in the bottom-left corner overlay. */
  const drawOverlay = (a: Actor, animated: boolean) => {
    const c = overSurf.px;
    octx.clearRect(0, 0, overSurf.W, overSurf.H);
    const feet = overSurf.H - LEDGE_ROWS * c;
    octx.drawImage(ledge.back, 0, feet, LEDGE_COLS * c, LEDGE_ROWS * c);
    const sprite = img(a, frameOf(a, animated));
    const jumpOff = jumpOffset(a);
    if (!jumpOff) {
      octx.globalAlpha = 0.5;
      octx.fillStyle = "#000";
      octx.fillRect(a.x + c, feet, a.w - 2 * c, c);
      octx.globalAlpha = 1;
    }
    octx.drawImage(sprite, a.x, feet - a.h - jumpOff, a.w, a.h);
    octx.drawImage(ledge.front, 0, feet - 2 * c, LEDGE_COLS * c, 2 * c);
    drawSelfExtras(overSurf, a.x, a.w, feet - a.h - jumpOff, animated);
  };

  /** True when the page shows plain background at this canvas point (no content block over it). */
  const isClear = (x: number, y: number) => {
    const cx = x / ratio;
    const cy = y / ratio;
    if (cx < 0 || cy < 0 || cx >= cssW || y >= visH) return false;
    const el = document.elementFromPoint(cx, cy);
    return !el || el === document.body || el === document.documentElement || el === canvas;
  };

  const drawOthers = (animated: boolean) => {
    const now = performance.now();
    let n = 0;
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (now - (o.e.start ?? now) >= duration(o.e)) continue;
      if (o.a && !o.a.leaving && o.a.age >= 0) {
        o.x = o.a.x + o.a.w / 2;
        o.top = baseOf(o.a) - o.a.h - jumpOffset(o.a) - 2 * o.a.cell;
      }
      // Keep the emoji and shout in the free gutter on the sprite's side, not behind the content.
      const g = gutter - 2 * px;
      const wide = g > 60 * ratio;
      otherSurf.left = !wide || o.x < W / 2 ? 0 : W - g;
      otherSurf.right = !wide || o.x >= W / 2 ? W : g;
      paintEmote(otherSurf, o.e, now, o.x, o.top, animated);
      others[n++] = o;
    }
    others.length = n;
  };

  const draw = (animated: boolean) => {
    ctx.clearRect(0, 0, W, H);
    scenery?.drawBack(ctx, clock, animated);

    // Insertion sort into a reused array: no per-frame allocation.
    order.length = 0;
    let selfActor: Actor | null = null;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (a.self) selfActor = a;
      if (a.age < 0 || (a.self && useOverlay)) continue;
      let j = order.length;
      order.push(a);
      while (j > 0 && before(a, order[j - 1])) {
        order[j] = order[j - 1];
        j--;
      }
      order[j] = a;
    }

    let selfX = -1;
    let selfTop = 0;
    let selfW = 0;
    for (let i = 0; i < order.length; i++) {
      const a = order[i];
      const cell = a.cell;
      const sprite = img(a, frameOf(a, animated));
      const pop = animated && a.age < POP_S ? easeOutBack(a.age / POP_S) : 1;
      const w = Math.max(1, Math.round(sprite.width * pop)) * cell;
      const h = Math.max(1, Math.round(sprite.height * pop)) * cell;
      const base = Math.round(baseOf(a));
      const jumpOff = jumpOffset(a);
      const cx = Math.round(a.x / cell) * cell + Math.round((sprite.width * cell - w) / 2 / cell) * cell;
      const alpha = (a.self ? 1 : DEPTH_ALPHA[plats[a.plat].depth]) * (a.leaving ? Math.max(0, 1 - a.leaving / FADE_S) : 1);

      if (a.mode !== "hop") {
        ctx.globalAlpha = alpha * 0.5 * (jumpOff ? 0.6 : 1);
        ctx.fillStyle = "#000";
        ctx.fillRect(cx + cell, base, w - 2 * cell, cell);
      }

      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, cx, base - h - jumpOff, w, h);

      if (a.self && pop === 1) {
        selfX = cx;
        selfW = w;
        selfTop = base - h - jumpOff;
      }

      if (animated && a.age < POP_S) {
        const t = a.age / POP_S;
        const r = (4 + t * 10) * cell;
        const mx = cx + w / 2;
        const my = base - (sprite.height * cell) / 2;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = "#ffd166";
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          ctx.fillRect(Math.round((mx + Math.cos(ang) * r) / cell) * cell, Math.round((my + Math.sin(ang) * r) / cell) * cell, cell, cell);
        }
      }
    }
    ctx.globalAlpha = 1;
    scenery?.drawFront?.(ctx, clock, animated);

    if (others.length) drawOthers(animated);

    // The YOU label and emotes sit above everything, scenery foreground included.
    if (selfX >= 0) drawSelfExtras(mainSurf, selfX, selfW, selfTop, animated);
    if (useOverlay && selfActor) drawOverlay(selfActor, animated);
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
      redrawStatic();
    } else if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  // Static (reduced-motion) mode has no loop: redraw when an emote appears and once it expires.
  const redrawStatic = () => {
    if (raf) return;
    draw(false);
    clearTimeout(staticTimer);
    if (emotes.length || others.length) staticTimer = setTimeout(redrawStatic, EMOTE_MS);
  };

  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
      redrawStatic();
    });
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
      // Content and HUD may have changed since the last layout: re-check the gutter and overlay.
      placeSelf();
      reconcile(motionQuery.matches);
      redrawStatic();
    },
    emote(emoji, shout) {
      emotes.push({
        emoji,
        shout,
        created: performance.now(),
        start: null,
        jitter: shout ? 0 : Math.round(rand(-3, 3)),
        lines: [],
        wrapKey: -1,
        lineW: 0,
      });
      if (emotes.length > MAX_EMOTES) emotes.splice(0, emotes.length - MAX_EMOTES);
      redrawStatic();
    },
    emoteOther(emoji, shout) {
      if (document.hidden) return;
      const e: Emote = { emoji, shout, created: performance.now(), start: performance.now(), jitter: 0, lines: [], wrapKey: -1, lineW: 0 };
      // Prefer a sprite whose head and the space above it are in view (not behind a card).
      const picks: Actor[] = [];
      for (const a of actors) {
        if (a.self || a.leaving || a.age < 0) continue;
        const x = a.x + a.w / 2;
        const top = baseOf(a) - a.h;
        if (isClear(x, top + a.cell) && isClear(x, top - 14 * a.cell)) picks.push(a);
      }
      if (picks.length) {
        const a = picks[Math.floor(Math.random() * picks.length)];
        others.push({ a, x: a.x + a.w / 2, top: baseOf(a) - a.h - 2 * a.cell, e });
      } else {
        // Nobody in view: the salve rises from a visible ledge instead.
        const spots: number[] = [];
        for (let i = 0; i < plats.length; i++) {
          const pl = plats[i];
          const x = (pl.x0 + pl.x1) / 2;
          if (isClear(x, pl.y - 2 * px) && isClear(x, pl.y - 18 * px)) spots.push(i);
        }
        if (!spots.length) return;
        const pl = plats[spots[Math.floor(Math.random() * spots.length)]];
        others.push({ a: null, x: (pl.x0 + pl.x1) / 2, top: pl.y - 4 * px, e });
      }
      if (others.length > MAX_EMOTES) others.splice(0, others.length - MAX_EMOTES);
      redrawStatic();
    },
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      clearTimeout(staticTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
      motionQuery.removeEventListener("change", start);
    },
  };
}

// Inline because the CSS module belongs to the UI agent; JS sets size, bottom offset and display.
const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  left: "max(12px, env(safe-area-inset-left))",
  bottom: "max(12px, env(safe-area-inset-bottom))",
  zIndex: 20,
  display: "none",
  pointerEvents: "none",
  imageRendering: "pixelated",
};

interface Props {
  onlineLabel: string;
  youLabel: string;
  visitsLabel: string;
  visitsShortLabel: string;
}

export default function PixelCrowd({ onlineLabel, youLabel, visitsLabel, visitsShortLabel }: Props) {
  const { online, visits } = usePresence();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const crowdRef = useRef<Crowd | null>(null);

  useEffect(() => {
    const crowd = createCrowd(canvasRef.current!, overlayRef.current!, getVisitorId(), youLabel, hudRef.current);
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

  useLiveSalves((r) => crowdRef.current?.emoteOther(r.emoji, "shout" in r ? r.shout : undefined));

  const extra = online !== null && online > MAX_SPRITES ? online - MAX_SPRITES : 0;

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <canvas ref={overlayRef} style={OVERLAY_STYLE} aria-hidden="true" />
      <div ref={hudRef} className={styles.hud}>
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
