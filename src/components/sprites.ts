export type Palette = Record<string, string>;

export interface SpriteDef {
  name: string;
  frames: [string[], string[]];
  palettes: Palette[];
}

export const BASE_PALETTE: Palette = {
  o: "#2b2140",
  e: "#120e1c",
  w: "#ece8f4",
  s: "#e3a982",
  p: "#ef8f9f",
  g: "#565a78",
  y: "#ffd166",
};

const humanLegs: [string[], string[]] = [
  ["...odo.odo..", "..odo...odo.", "..oo.....oo."],
  ["....oddo....", "....oddo....", "....oooo...."],
];

const gamer: SpriteDef = {
  name: "gamer",
  frames: [humanLegs[0], humanLegs[1]].map((legs) => [
    "....oooo....",
    "...oaaaaoo..",
    "..oaaaaaaaoo",
    "..okkkkoooo.",
    "..okksesseo.",
    "..okssssso..",
    "...osssspo..",
    "....ossso...",
    "...occccco..",
    "..occcccco..",
    "..ocsggggso.",
    "...oglgygo..",
    "...occcco...",
    ...legs,
  ]) as [string[], string[]],
  palettes: [
    { a: "#e05561", k: "#5b3a29", c: "#3f7fd0", d: "#2f3a5c" },
    { a: "#3fb68b", k: "#2a2a35", c: "#e8a33d", d: "#3b3350", s: "#b97a56" },
    { a: "#8a63d2", k: "#d9a441", c: "#e05561", d: "#2a3f5f" },
    { a: "#2f9fd8", k: "#7a3b2e", c: "#58b368", d: "#433a5e", s: "#8d5a3b" },
  ],
};

const robot: SpriteDef = {
  name: "robot",
  frames: [
    ["..odo...odo.", "..oo....oo.."],
    ["...odo.odo..", "...oo..oo..."],
  ].map((legs) => [
    ".....oo.....",
    ".....ol.....",
    "......o.....",
    "..oooooooo..",
    ".oaaaaaaaao.",
    ".oacccccaao.",
    ".oacwcwcaao.",
    ".oacccccaao.",
    ".oaaaaaaaao.",
    "..oooooooo..",
    ".oobbbbbboo.",
    "oaobblbybboa",
    "oaobbbbbboao",
    "..obbbbbbo..",
    "..oooooooo..",
    ...legs,
  ]) as [string[], string[]],
  palettes: [
    { a: "#9aa3b8", b: "#6b7390", c: "#1d3b4f", l: "#ff5d73", d: "#4b5068" },
    { a: "#d9b45a", b: "#a3803a", c: "#26203a", l: "#5ee6c5", d: "#6b5530" },
    { a: "#7fc4a8", b: "#4f8f78", c: "#1b2e3a", l: "#ffd166", d: "#3d6458" },
    { a: "#c58ad8", b: "#8f5aa3", c: "#221836", l: "#7bdff2", d: "#5c3d6b" },
  ],
};

const ghost: SpriteDef = {
  name: "ghost",
  frames: [
    ["oaaaaaaaaaao", "oaaobaaobaao", "oaoo.oao.ooo", ".o....o....."],
    ["oaaaaaaaaaao", "oabaaobaaobo", "ooo.oao.ooao", ".....o....o."],
  ].map((hem) => [
    "....oooo....",
    "..ooaaaaoo..",
    ".oaaaaawwao.",
    ".oaaaaaawao.",
    "oaaaaaaaaaao",
    "oaaaaeaaeaao",
    "oaaaaeaaeaao",
    "oaaapaaaapao",
    "oaaaaaeeaaao",
    "oaaaaaaaaaao",
    "obaaaaaaaaao",
    "obbaaaaaaabo",
    ...hem,
  ]) as [string[], string[]],
  palettes: [
    { a: "#d8d4ec", b: "#a9a3c9" },
    { a: "#a8e6cf", b: "#76b39d" },
    { a: "#ffc7d6", b: "#d993a8" },
    { a: "#b8d8ff", b: "#82a6d6" },
  ],
};

const cat: SpriteDef = {
  name: "cat",
  frames: [
    [".oao.oao...oao.oao", ".oo...oo...oo...oo"],
    ["..oao.oao.oao.oao.", "..oo...oo.oo...oo."],
  ].map((legs) => [
    "............o...o.",
    "..o........opo.opo",
    ".oao.......oaaaaao",
    ".oao.......oaeaeao",
    "..oao......oaapaao",
    "...oaoooooooaaaao.",
    "...oaababababaaao.",
    "...oaaaaaaaaaaao..",
    "...obaaaaaaaaabo..",
    "...oobbbbbbbbboo..",
    ...legs.map((r) => r.slice(0, 18)),
  ]) as [string[], string[]],
  palettes: [
    { a: "#e8a35b", b: "#b8743a" },
    { a: "#8d8fa3", b: "#5f6177" },
    { a: "#f0e6d8", b: "#c4b49c" },
    { a: "#3d3550", b: "#272035", e: "#ffd166" },
  ],
};

const knight: SpriteDef = {
  name: "knight",
  frames: [humanLegs[0], humanLegs[1]].map((legs) => [
    ".....cc.....",
    "....occo....",
    "...oaaaao...",
    "..oaaaaaao..",
    "..oaaaaaaao.",
    "..oaaaeeeeo.",
    "..oaaaaaaao.",
    "...oaaaaao..",
    "..obbbbbbo..",
    ".oabbbbodddo",
    ".oabbbbodcdo",
    "..obbbbodddo",
    "..obbbbbodo.",
    "...oooooo...",
    ...legs.map((r) => r.replace(/d/g, "b")),
  ]) as [string[], string[]],
  palettes: [
    { a: "#b9c0d4", b: "#8a92aa", c: "#e05561", d: "#3f7fd0" },
    { a: "#d9b45a", b: "#a3803a", c: "#5ee6c5", d: "#8a3b4f" },
    { a: "#9aa3b8", b: "#6b7390", c: "#ffd166", d: "#3a8f5c" },
    { a: "#c9a2e0", b: "#9a72b3", c: "#7bdff2", d: "#5c3d8f" },
  ],
};

const slime: SpriteDef = {
  name: "slime",
  frames: [
    [
      "............",
      "............",
      ".....oo.....",
      "...ooaaoo...",
      "..oaawaaao..",
      ".oaawaaaaao.",
      ".oaaaeaeaao.",
      "oaaaaaaaaaao",
      "oaaapaaapaao",
      "obaaaaaaaabo",
      "obbaaaaaabbo",
      ".oooooooooo.",
    ],
    [
      "............",
      "............",
      "............",
      "............",
      "....oooo....",
      "..ooaaaaoo..",
      ".oaawaaaaao.",
      "oaawaeaeaaao",
      "oaaapaaapaao",
      "obaaaaaaaabo",
      "obbbaaaaabbo",
      "oooooooooooo",
    ],
  ],
  palettes: [
    { a: "#6fd08c", b: "#3f9a5f" },
    { a: "#5aa9e6", b: "#3a74b0" },
    { a: "#f28fb0", b: "#c25f83" },
    { a: "#f2c14e", b: "#c28f2a" },
  ],
};

const mage: SpriteDef = {
  name: "mage",
  frames: [
    ["...odo.odo..", "...oo...oo.."],
    ["....oddo....", "....oooo...."],
  ].map((legs) => [
    "......o.....",
    ".....oao....",
    ".....oayo...",
    "....oaaao...",
    "...oaaaaao..",
    ".ooooooooooo",
    "..okssesso..",
    "..okssssso..",
    "..owwwwwwo..",
    "..oawwwwaoo.",
    ".oaaawwaaosl",
    ".oaaaaaaaosg",
    ".oaaabaaao.g",
    "..oaaaaaao.g",
    ...legs,
  ]) as [string[], string[]],
  palettes: [
    { a: "#5b4bd1", b: "#ffd166", k: "#e8e6f0", d: "#2f2a55", l: "#7bdff2" },
    { a: "#c0392b", b: "#ffd166", k: "#e8e6f0", d: "#4a1f1a", l: "#ffd166" },
    { a: "#2e8b6e", b: "#e8e6f0", k: "#e8e6f0", d: "#1f4a3c", l: "#ff8fab" },
    { a: "#8e44ad", b: "#5ee6c5", k: "#e8e6f0", d: "#3d1f4a", l: "#5ee6c5" },
  ],
};

export const SPRITES: SpriteDef[] = [gamer, robot, ghost, cat, knight, slime, mage];

export const SPRITE_HEIGHT = Math.max(...SPRITES.flatMap((s) => s.frames.map((f) => f.length)));

/** Renders one frame to a 1x canvas (optionally mirrored) for cheap scaled blits. */
export function rasterize(sprite: SpriteDef, paletteIndex: number, frame: 0 | 1, flip: boolean): HTMLCanvasElement {
  const rows = sprite.frames[frame];
  const width = Math.max(...rows.map((r) => r.length));
  const palette = { ...BASE_PALETTE, ...sprite.palettes[paletteIndex % sprite.palettes.length] };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? width - 1 - x : x, y, 1, 1);
    }
  });
  return canvas;
}

const GLYPHS: Record<string, string[]> = {
  V: ["101", "101", "101", "101", "010"],
  O: ["111", "101", "101", "101", "111"],
  C: ["111", "100", "100", "100", "111"],
  Ê: ["010", "111", "100", "110", "111"],
  Y: ["101", "101", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  Ú: ["001", "010", "101", "101", "111"],
  T: ["111", "010", "010", "010", "010"],
};

/** Short label ("YOU", "TÚ", "VOCÊ") in a 3x5 bitmap font; each glyph is 3px wide plus a 1px gap. */
export function rasterizeLabel(text: string, color: string): HTMLCanvasElement {
  const chars = [...text];
  const canvas = document.createElement("canvas");
  canvas.width = chars.length * 4 - 1;
  canvas.height = 5;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  chars.forEach((ch, i) =>
    (GLYPHS[ch] ?? []).forEach((row, y) =>
      [...row].forEach((bit, x) => bit === "1" && ctx.fillRect(i * 4 + x, y, 1, 1)),
    ),
  );
  return canvas;
}

// 14x10 pixel Brazil flag (G green, Y yellow, B blue, W white band), drawn instead of the 🇧🇷 emoji,
// which Windows renders as the letters "BR".
export const FLAG_BR = [
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
];
export const FLAG_COLORS: Record<string, string> = { G: "#009c3b", Y: "#ffdf00", B: "#002776", W: "#ffffff" };

export function rasterizeFlagBR(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FLAG_BR[0].length;
  canvas.height = FLAG_BR.length;
  const ctx = canvas.getContext("2d")!;
  FLAG_BR.forEach((row, y) =>
    [...row].forEach((c, x) => {
      ctx.fillStyle = FLAG_COLORS[c];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return canvas;
}
