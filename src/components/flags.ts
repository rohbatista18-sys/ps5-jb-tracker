// Pixel-art flags, drawn the same on every OS (Windows has no flag emojis). One char = one pixel.
export interface PixelFlagArt {
  rows: readonly string[];
  colors: Readonly<Record<string, string>>;
}

const vertical = (a: string, b: string, c: string) => Array(10).fill(`${a.repeat(5)}${b.repeat(4)}${c.repeat(5)}`);
const horizontal = (a: string, b: string, c: string) => [a, a, a, b, b, b, b, c, c, c].map((ch) => ch.repeat(14));

export const FLAGS = {
  brazil: {
    rows: [
      "GGGGGGYYGGGGGG",
      "GGGGYYYYYYGGGG",
      "GGYYYYBBYYYYGG",
      "GYYYYBBBBYYYYG",
      "YYYYBWWWWBYYYY",
      "YYYYWBBBBWYYYY",
      "GYYYYBBBBYYYYG",
      "GGYYYYBBYYYYGG",
      "GGGGYYYYYYGGGG",
      "GGGGGGYYGGGGGG",
    ],
    colors: { G: "#009c3b", Y: "#ffdf00", B: "#002776", W: "#ffffff" },
  },
  us: {
    rows: [
      "BWBWBBRRRRRRRR",
      "BBWBWBWWWWWWWW",
      "BWBWBBRRRRRRRR",
      "BBWBWBWWWWWWWW",
      "BWBWBBRRRRRRRR",
      "BBWBWBWWWWWWWW",
      "RRRRRRRRRRRRRR",
      "WWWWWWWWWWWWWW",
      "RRRRRRRRRRRRRR",
      "WWWWWWWWWWWWWW",
      "RRRRRRRRRRRRRR",
    ],
    colors: { R: "#b22234", W: "#ffffff", B: "#3c3b6e" },
  },
  cn: {
    rows: [
      "RRRRRRRRRRRRRR",
      "RRYRRYRRRRRRRR",
      "RYYYRRRYRRRRRR",
      "RRYRRRRYRRRRRR",
      "RYRYRYRRRRRRRR",
      "RRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRR",
    ],
    colors: { R: "#de2910", Y: "#ffde00" },
  },
  de: { rows: horizontal("K", "R", "Y"), colors: { K: "#000000", R: "#dd0000", Y: "#ffce00" } },
  jp: {
    rows: [
      "WWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWW",
      "WWWWWWRRWWWWWW",
      "WWWWWRRRRWWWWW",
      "WWWWRRRRRRWWWW",
      "WWWWRRRRRRWWWW",
      "WWWWWRRRRWWWWW",
      "WWWWWWRRWWWWWW",
      "WWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWW",
    ],
    colors: { W: "#ffffff", R: "#bc002d" },
  },
  in: {
    rows: horizontal("O", "W", "G").map((r, y) => (y === 4 || y === 5 ? "WWWWWWBBWWWWWW" : r)),
    colors: { O: "#ff9933", W: "#ffffff", G: "#138808", B: "#000080" },
  },
  gb: {
    rows: [
      "RWBBBWRRWBBBWR",
      "BWRWBWRRWBWRWB",
      "BBWRWWRRWWRWBB",
      "WWWWWWRRWWWWWW",
      "RRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRR",
      "WWWWWWRRWWWWWW",
      "BBWRWWRRWWRWBB",
      "BWRWBWRRWBWRWB",
      "RWBBBWRRWBBBWR",
    ],
    colors: { B: "#012169", W: "#ffffff", R: "#c8102e" },
  },
  fr: { rows: vertical("B", "W", "R"), colors: { B: "#0055a4", W: "#ffffff", R: "#ef4135" } },
  it: { rows: vertical("G", "W", "R"), colors: { G: "#009246", W: "#ffffff", R: "#ce2b37" } },
} satisfies Record<string, PixelFlagArt>;

export type FlagKey = keyof typeof FLAGS;
export const isFlagKey = (k: string): k is FlagKey => k in FLAGS;

const canvases = new Map<string, HTMLCanvasElement>();

/** The flag as a 1-px-per-cell canvas, cached (client only). */
export function rasterizeFlag(key: FlagKey): HTMLCanvasElement {
  let canvas = canvases.get(key);
  if (canvas) return canvas;
  const { rows, colors } = FLAGS[key] as PixelFlagArt;
  canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      ctx.fillStyle = colors[c];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  canvases.set(key, canvas);
  return canvas;
}
