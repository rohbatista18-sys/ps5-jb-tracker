import { FLAG_BR, FLAG_COLORS } from "./sprites";

/** Pixel-art Brazil flag as inline SVG, so it looks the same on every OS (Windows has no flag emojis). */
export default function FlagBR({ size = 18 }: { size?: number }) {
  const w = FLAG_BR[0].length;
  const h = FLAG_BR.length;
  return (
    <svg
      width={size * (w / h)}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {FLAG_BR.flatMap((row, y) =>
        [...row].map((c, x) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FLAG_COLORS[c]} />),
      )}
    </svg>
  );
}
