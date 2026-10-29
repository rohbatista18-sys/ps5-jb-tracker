import { FLAGS, type FlagKey, type PixelFlagArt } from "./flags";

/** Pixel-art flag as inline SVG, so it looks the same on every OS (Windows has no flag emojis). */
export default function PixelFlag({ flag, size = 18 }: { flag: FlagKey; size?: number }) {
  const { rows, colors } = FLAGS[flag] as PixelFlagArt;
  const w = rows[0].length;
  const h = rows.length;
  return (
    <svg
      width={size * (w / h)}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[c]} />),
      )}
    </svg>
  );
}
