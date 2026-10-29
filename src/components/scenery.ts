// Pixel-art background scenery for PixelCrowd: a quiet night city under a starfield, with
// floating rock ledges in the page gutters where the visitor sprites stand and walk.
//
// Everything static is rendered once per createScenery() into offscreen canvases, so the
// per-frame drawBack/drawFront calls are a single drawImage plus a handful of twinkling stars.
// `t` is in SECONDS (only used for the stepped twinkle and the occasional shooting star).

export interface Platform { x0: number; x1: number; y: number; depth: 0 | 1 | 2 } // device px; y = feet baseline; depth 0 = far, 2 = near
export interface Scenery {
  platforms: Platform[];
  drawBack(ctx: CanvasRenderingContext2D, t: number, animated: boolean): void;
  drawFront?(ctx: CanvasRenderingContext2D, t: number, animated: boolean): void;
}

/** Sprite opacity per depth: far sprites sink into the night. */
export const DEPTH_ALPHA: readonly [number, number, number] = [0.5, 0.75, 1];
/** Multiplier of `px` per depth; round(px * s), min 1, gives the art-pixel size at that depth. */
export const DEPTH_SCALE: readonly [number, number, number] = [0.5, 0.75, 1];

type Ctx = CanvasRenderingContext2D;
type Depth = 0 | 1 | 2;
interface Rect { x: number; y: number; w: number; h: number }
interface Star { x: number; y: number; s: number; color: string; base: number; rate: number; off: number; plus: boolean }

// Site palette (globals.css), plus a few darkened derivatives so the scene stays low-contrast.
const INK_FAINT = "#9e9dcc";
const BLUE = "#0070d1";
const BLUE_HI = "#5aa9ff";
const CYAN = "#2de2e6";
const MAGENTA = "#ff3ea5";
const YELLOW = "#ffd23f";
const LINE = "#2a2a52";

const LEDGE = [
  { top: "#202048", body: "#16162f", dark: "#0f0f22", spark: CYAN, sparkA: 0.18 },
  { top: "#2b2b5e", body: "#1b1b3c", dark: "#121229", spark: CYAN, sparkA: 0.26 },
  { top: "#3a3a7c", body: "#222249", dark: "#15152f", spark: MAGENTA, sparkA: 0.34 },
] as const;

const SHAPES: { color: string; nodes: [number, number][]; closed: boolean; extra?: [number, number][] }[] = [
  { color: "#40e0b0", nodes: [[0, 4], [2, 0], [4, 4]], closed: true }, // triangle
  { color: "#ff5a6e", nodes: [[2, 0], [3.4, 0.6], [4, 2], [3.4, 3.4], [2, 4], [0.6, 3.4], [0, 2], [0.6, 0.6]], closed: true }, // circle
  { color: BLUE_HI, nodes: [[0, 0], [2, 2], [4, 4]], closed: false, extra: [[4, 0], [2, 2], [0, 4]] }, // cross
  { color: "#ff8ad8", nodes: [[0, 0], [4, 0], [4, 4], [0, 4]], closed: true }, // square
];

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const snap = (v: number, g: number) => Math.round(v / g) * g;
const hits = (a: Rect, list: Rect[]) =>
  list.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

function fill(c: Ctx, x: number, y: number, w: number, h: number, color: string, alpha = 1) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function makeLayer(W: number, H: number) {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  return { cv, c };
}

export function createScenery(W: number, H: number, px: number, seed: number): Scenery {
  W = Math.max(1, Math.round(W));
  H = Math.max(1, Math.round(H));
  px = Math.max(1, Math.round(px));
  const rnd = mulberry32((seed ^ Math.imul(W, 73856093) ^ Math.imul(H, 19349663)) >>> 0);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const ri = (a: number, b: number) => Math.floor(r(a, b + 1));
  const P = DEPTH_SCALE.map((s) => Math.max(1, Math.round(px * s))) as unknown as readonly [number, number, number];

  const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const cssW = W / dpr;
  const mobile = cssW < 640;
  // Centered content: .page max-width 1240px with a 16px inner gutter.
  const half = (Math.min(cssW, 1240) / 2 - 16) * dpr;
  const gutter = Math.max(0, W / 2 - half);
  const wideGutter = gutter >= 110 * dpr;

  const back = makeLayer(W, H);
  const front = makeLayer(W, H);
  const b = back.c;
  const f = front.c;

  // ---------- vertical bands ----------
  const groundH = snap(Math.max(4 * px, H * 0.035), px);
  const groundY = H - groundH;
  const skyH = snap(H * (mobile ? 0.11 : 0.15), px);
  const skyTop = groundY - skyH; // tallest building

  const blocked: Rect[] = [];
  const platforms: Platform[] = [];

  // ---------- ringed planet ----------
  const R = (mobile ? 6 : 8) * P[1];
  const leftMoon = rnd() < 0.5;
  const moonX = snap(mobile ? W * 0.84 : wideGutter ? (leftMoon ? gutter / 2 : W - gutter / 2) : leftMoon ? W * 0.07 : W * 0.93, P[1]);
  const moonY = snap(Math.max(R + 4 * px, H * 0.08), P[1]);
  blocked.push({ x: moonX - R * 2, y: moonY - R - 2 * px, w: R * 4, h: R * 2 + 4 * px });

  // ---------- ledges ----------
  const ledges: { x: number; y: number; w: number; d: Depth }[] = [];
  const addLedge = (xa: number, xb: number, y: number, d: Depth, wMin: number, wMax: number) => {
    const p = P[d];
    const zone = Math.floor((xb - xa) / p);
    const w = Math.max(20, Math.min(ri(wMin, wMax), zone));
    const x = snap(r(xa, Math.max(xa, xb - w * p)), p);
    const yy = snap(y, p);
    const box = { x: x - 2 * p, y: yy - 20 * p, w: (w + 4) * p, h: 30 * p };
    if (hits(box, blocked)) return;
    blocked.push(box);
    ledges.push({ x, y: yy, w, d });
    const x0 = Math.max(0, x + 2 * p);
    const x1 = Math.min(W, x + (w - 2) * p);
    if (x1 - x0 >= 14 * p) platforms.push({ x0, x1, y: yy, depth: d });
  };

  const topY = moonY + R + 10 * px;
  const lowY = skyTop - 6 * px;
  if (mobile) {
    addLedge(W * 0.03, W * 0.45, H * r(0.08, 0.13), 1, 28, 40);
    addLedge(W * 0.55, W * 0.97, topY + H * r(0, 0.02), 0, 34, 50); // just under the planet, above the title
    addLedge(W * 0.02, W * 0.42, lowY - H * r(0, 0.05), 2, 24, 34);
    addLedge(W * 0.58, W * 0.98, lowY - H * r(0.09, 0.15), 1, 28, 40);
  } else {
    const zoneW = wideGutter ? gutter - 8 * dpr : Math.max(gutter, 140 * dpr);
    const n = wideGutter ? Math.max(2, Math.min(5, Math.round((lowY - topY) / (170 * dpr)))) : 2;
    const cycle: Depth[] = [2, 0, 1, 2, 1, 0];
    const wRange: [number, number][] = [[34, 56], [30, 46], [26, 38]];
    for (let side = 0; side < 2; side++) {
      const xa = side === 0 ? 0 : W - zoneW;
      const xb = side === 0 ? zoneW : W;
      for (let i = 0; i < n; i++) {
        const tt = (i + (side ? 0.45 : 0) + r(0.05, 0.5)) / (n + 0.5);
        const d = cycle[(i + side * 2) % cycle.length];
        addLedge(xa, xb, topY + tt * (lowY - topY), d, wRange[d][0], wRange[d][1]);
      }
    }
  }
  ledges.sort((a, c) => a.d - c.d);

  // ---------- stars ----------
  const twinkles: Star[] = [];
  const starColors = [INK_FAINT, INK_FAINT, INK_FAINT, BLUE_HI, CYAN, "#ecebff"];
  const nStars = Math.round(((W / px) * (skyTop / px)) / 650);
  for (let i = 0; i < nStars; i++) {
    const s = rnd() < 0.85 ? P[0] : P[1];
    const x = snap(r(0, W - s), P[0]);
    const y = snap(r(0, skyTop - 6 * px), P[0]);
    if (hits({ x: x - s, y: y - s, w: s * 3, h: s * 3 }, blocked)) continue;
    const star: Star = {
      x, y, s,
      color: starColors[ri(0, starColors.length - 1)],
      base: r(0.16, 0.42),
      rate: r(0.4, 1.3),
      off: r(0, 4),
      plus: rnd() < 0.035,
    };
    if (star.plus) star.base = r(0.3, 0.5);
    if (star.plus ? rnd() < 0.6 : rnd() < 0.14) twinkles.push(star);
    else drawStar(b, star, star.base);
  }

  // ---------- PlayStation-shape constellations ----------
  {
    const unit = 4 * P[1];
    const size = unit * 4 + P[1];
    const order = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    const placed: Rect[] = [];
    for (const k of order) {
      for (let tries = 0; tries < 30; tries++) {
        const side = rnd() < 0.5;
        const zx = mobile ? r(0, W - size) : wideGutter
          ? (side ? r(8 * dpr, Math.max(8 * dpr, gutter - size - 8 * dpr)) : r(W - gutter + 8 * dpr, Math.max(W - gutter + 8 * dpr, W - size - 8 * dpr)))
          : (side ? r(0, W * 0.12) : r(W * 0.88 - size, W - size));
        const zy = r(H * 0.04, skyTop - size - 8 * px);
        const box = { x: snap(zx, P[1]), y: snap(zy, P[1]), w: size, h: size };
        if (hits({ x: box.x - 4 * px, y: box.y - 4 * px, w: size + 8 * px, h: size + 8 * px }, [...blocked, ...placed])) continue;
        placed.push(box);
        drawConstellation(b, SHAPES[k], box.x, box.y, unit, P);
        break;
      }
    }
    blocked.push(...placed);
  }

  // ---------- planet ----------
  drawPlanet(b, moonX, moonY, R, P[1]);

  // ---------- skyline: far layer ----------
  for (let x = -ri(0, 6) * P[0]; x < W; ) {
    const bw = ri(5, 14) * P[0];
    const bh = snap(r(0.35, 1) * skyH, P[0]);
    fill(b, x, groundY - bh, bw, bh, "#11112a");
    if (rnd() < 0.18) fill(b, x + snap(bw / 2, P[0]), groundY - bh - 3 * P[0], P[0], 3 * P[0], "#11112a");
    if (rnd() < 0.5) {
      for (let wy = groundY - bh + 2 * P[0]; wy < groundY - 2 * P[0]; wy += 3 * P[0])
        for (let wx = x + P[0]; wx < x + bw - P[0]; wx += 2 * P[0])
          if (rnd() < 0.05) fill(b, wx, wy, P[0], P[0], rnd() < 0.6 ? YELLOW : CYAN, 0.14);
    }
    x += bw + (rnd() < 0.2 ? ri(1, 4) * P[0] : 0);
  }
  // ---------- skyline: near layer ----------
  for (let x = -ri(0, 8) * P[1]; x < W; ) {
    const bw = ri(6, 16) * P[1];
    const bh = snap(r(0.2, 0.62) * skyH, P[1]);
    const top = groundY - bh;
    fill(b, x, top, bw, bh, "#0c0c1d");
    fill(b, x, top, bw, P[1], "#1a1a3a");
    if (rnd() < 0.25) fill(b, x + P[1], top - 2 * P[1], 2 * P[1], 2 * P[1], "#0c0c1d"); // roof box
    for (let wy = top + 2 * P[1]; wy < groundY - 2 * P[1]; wy += 3 * P[1])
      for (let wx = x + P[1]; wx < x + bw - P[1]; wx += 2 * P[1])
        if (rnd() < 0.1) {
          const c = rnd();
          fill(b, wx, wy, P[1], P[1], c < 0.6 ? YELLOW : c < 0.85 ? CYAN : MAGENTA, c < 0.6 ? 0.22 : 0.17);
        }
    x += bw + (rnd() < 0.3 ? ri(1, 5) * P[1] : 0);
  }

  // ---------- ground ----------
  fill(b, 0, groundY, W, groundH, "#07070e");
  for (let x = 0; x < W; x += px) {
    fill(b, x, groundY, px, px, (x / px) % 6 < 3 ? LINE : "#333366");
    if (rnd() < 0.08) fill(b, x, groundY + px * ri(2, 3), px, px, "#121228");
  }
  fill(b, 0, groundY + px, W, px, BLUE, 0.16);
  platforms.push({ x0: 0, x1: W, y: groundY, depth: 2 });

  // ---------- ledges (far to near) ----------
  for (const l of ledges) drawLedge(b, f, l.x, l.y, l.w, l.d, P[l.d], rnd);

  // ---------- ground tufts (front) ----------
  for (let x = ri(0, 6) * px; x < W; x += ri(5, 12) * px) {
    const h = rnd() < 0.3 ? 2 : 1;
    fill(f, x, groundY - h * px, px, h * px, rnd() < 0.5 ? "#1f5a6a" : "#24407a", 0.55);
    if (rnd() < 0.4) fill(f, x + px, groundY - px, px, px, "#1f5a6a", 0.45);
  }

  b.globalAlpha = 1;
  f.globalAlpha = 1;

  // ---------- shooting star (animated only) ----------
  const shoot = {
    period: r(14, 22),
    off: r(0, 10),
    x: r(W * 0.15, W * 0.85),
    y: r(H * 0.04, Math.max(H * 0.05, skyTop * 0.35)),
    dir: rnd() < 0.5 ? 1 : -1,
    len: 70 * P[0],
  };

  return {
    platforms,
    drawBack(ctx, t, animated) {
      ctx.drawImage(back.cv, 0, 0);
      const levels = [0.25, 0.6, 1, 0.6];
      for (const s of twinkles) {
        const a = animated ? s.base * 1.7 * levels[Math.floor(t * s.rate + s.off) % 4] : s.base;
        drawStar(ctx, s, Math.min(0.85, a));
      }
      if (animated) {
        const ph = (t + shoot.off) % shoot.period;
        const dur = 0.75;
        if (ph < dur) {
          const k = ph / dur;
          const step = P[0];
          const hx = snap(shoot.x + shoot.dir * k * shoot.len, step);
          const hy = snap(shoot.y + k * shoot.len * 0.45, step);
          for (let i = 0; i < 10; i++) {
            const a = (1 - i / 10) * 0.55 * (1 - k * 0.6);
            fill(ctx, hx - shoot.dir * i * step * 2, hy - snap(i * step * 0.9, step), step * 2, step, i ? BLUE_HI : "#ecebff", a);
          }
        }
      }
      ctx.globalAlpha = 1;
    },
    drawFront(ctx) {
      ctx.drawImage(front.cv, 0, 0);
    },
  };
}

function drawStar(c: Ctx, s: Star, a: number) {
  fill(c, s.x, s.y, s.s, s.s, s.color, a);
  if (s.plus) {
    const q = s.s;
    fill(c, s.x - q, s.y, q, q, s.color, a * 0.45);
    fill(c, s.x + q, s.y, q, q, s.color, a * 0.45);
    fill(c, s.x, s.y - q, q, q, s.color, a * 0.45);
    fill(c, s.x, s.y + q, q, q, s.color, a * 0.45);
  }
}

function drawConstellation(c: Ctx, shape: (typeof SHAPES)[number], x: number, y: number, unit: number, P: readonly [number, number, number]) {
  const paths = [shape.nodes, ...(shape.extra ? [shape.extra] : [])];
  for (const nodes of paths) {
    const segs = nodes.length - (shape.closed ? 0 : 1);
    for (let i = 0; i < segs; i++) {
      const [ax, ay] = nodes[i];
      const [bx, by] = nodes[(i + 1) % nodes.length];
      const x0 = x + ax * unit, y0 = y + ay * unit, x1 = x + bx * unit, y1 = y + by * unit;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / P[0];
      for (let k = 2; k < n - 1; k += 2) {
        const px = snap(x0 + ((x1 - x0) * k) / n, P[0]);
        const py = snap(y0 + ((y1 - y0) * k) / n, P[0]);
        fill(c, px, py, P[0], P[0], shape.color, 0.1);
      }
    }
    for (const [nx, ny] of nodes) {
      const cx = snap(x + nx * unit, P[0]), cy = snap(y + ny * unit, P[0]);
      fill(c, cx - P[0], cy - P[0], P[1] + P[0], P[1] + P[0], shape.color, 0.1);
      fill(c, cx, cy, P[0], P[0], shape.color, 0.42);
    }
  }
}

function drawPlanet(c: Ctx, cx: number, cy: number, R: number, p: number) {
  const r = R / p;
  const ring = (i: number, j: number) => {
    // Tilted ellipse band
    const u = i * 0.94 + j * 0.34, v = -i * 0.34 + j * 0.94;
    const e = (u / (r * 1.85)) ** 2 + (v / (r * 0.42)) ** 2;
    return e > 0.78 && e < 1.0;
  };
  const span = Math.ceil(r * 2);
  // Ring behind the planet
  for (let j = -span; j <= span; j++)
    for (let i = -span; i <= span; i++)
      if (ring(i, j) && -i * 0.34 + j * 0.94 < 0) fill(c, cx + i * p, cy + j * p, p, p, BLUE, 0.28);
  for (let j = -Math.ceil(r); j <= r; j++)
    for (let i = -Math.ceil(r); i <= r; i++) {
      if (i * i + j * j > r * r) continue;
      const shade = (i - r * 0.45) ** 2 + (j - r * 0.3) ** 2 < (r * 0.95) ** 2;
      const band = Math.abs(j + Math.round(r * 0.25)) < 1 || Math.abs(j - Math.round(r * 0.45)) < 1;
      let col = shade ? "#121230" : "#262e66";
      if (!shade && band) col = "#1e2557";
      if (shade && band) col = "#10102a";
      fill(c, cx + i * p, cy + j * p, p, p, col);
    }
  // Ring in front
  for (let j = -span; j <= span; j++)
    for (let i = -span; i <= span; i++)
      if (ring(i, j) && -i * 0.34 + j * 0.94 >= 0) fill(c, cx + i * p, cy + j * p, p, p, BLUE_HI, 0.3);
  c.globalAlpha = 1;
}

function drawLedge(b: Ctx, f: Ctx, x: number, y: number, w: number, d: Depth, p: number, rnd: () => number) {
  const pal = LEDGE[d];
  const ri = (a: number, c: number) => a + Math.floor(rnd() * (c - a + 1));
  // Faint glow pooled under the ledge, so it reads as lit from the city below.
  fill(b, x + 2 * p, y + 4 * p, (w - 4) * p, p, BLUE, 0.05 + d * 0.03);
  // Top surface (rounded corners) + body
  fill(b, x + p, y, (w - 2) * p, p, pal.top);
  fill(b, x, y + p, w * p, 2 * p, pal.body);
  fill(b, x + p, y + 3 * p, (w - 2) * p, p, pal.dark);
  // Surface highlight specks
  for (let i = 2; i < w - 2; i += ri(3, 7)) fill(b, x + i * p, y, p, p, BLUE_HI, 0.18 + d * 0.08);
  // Brick-ish texture in the body
  for (let i = 1; i < w - 1; i += ri(3, 6)) fill(b, x + i * p, y + (1 + (i % 2)) * p, p, p, pal.dark);
  // Crumbling underside: taper into a floating rock
  let l = 1, rr = 1;
  const rows = ri(3, 5);
  let rowY = y + 4 * p;
  for (let k = 0; k < rows && l + rr < w - 4; k++) {
    l += ri(1, 3);
    rr += ri(1, 3);
    fill(b, x + l * p, rowY, (w - l - rr) * p, p, pal.dark);
    if (rnd() < 0.6) fill(b, x + (l + ri(0, Math.max(0, w - l - rr - 1))) * p, rowY, p, p, pal.body);
    rowY += p;
  }
  // Hanging crystals / drips
  const drips = ri(1, 2 + d);
  for (let k = 0; k < drips; k++) {
    const dx = x + ri(l, Math.max(l, w - rr - 1)) * p;
    fill(b, dx, rowY, p, ri(1, 2) * p, pal.spark, pal.sparkA);
  }
  b.globalAlpha = 1;
  // Front: grass tufts on mid and near ledges (drawn over sprite feet)
  if (d > 0) {
    for (let i = ri(1, 4); i < w - 1; i += ri(4, 9)) {
      const h = rnd() < 0.35 ? 2 : 1;
      fill(f, x + i * p, y - h * p, p, h * p, d === 2 ? "#2a7a6a" : "#24506a", d === 2 ? 0.6 : 0.45);
      if (rnd() < 0.5) fill(f, x + (i + 1) * p, y - p, p, p, d === 2 ? "#1f5a5a" : "#203f5a", 0.5);
    }
    f.globalAlpha = 1;
  }
}
