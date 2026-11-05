import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./BigNotice.module.css";

// Pixel plane facing left, on a 20×12 grid (1 unit = 5px). [x, y, w, h, fill]
const BODY: [number, number, number, number, string][] = [
  [14, 0, 2, 4, "var(--red)"], // tail fin
  [13, 2, 1, 2, "var(--red)"],
  [5, 3, 9, 1, "var(--red)"],
  [3, 4, 15, 3, "var(--red)"],
  [3, 7, 12, 1, "#b8304a"], // belly shade
  [14, 5, 5, 1, "var(--yellow)"], // tail plane
  [1, 4, 2, 3, "var(--ink-dim)"], // nose
  [6, 2, 3, 2, "var(--cyan)"], // cockpit
  [7, 6, 5, 2, "var(--yellow)"], // wing
  [8, 8, 3, 1, "#c99a16"],
  [9, 9, 1, 2, "var(--ink-dim)"], // landing gear
  [8, 11, 3, 1, "var(--ink-dim)"],
];

function Plane() {
  return (
    <svg className={styles.plane} viewBox="0 0 20 12" shapeRendering="crispEdges">
      {BODY.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
      <rect x={0} y={5} width={1} height={1} fill="var(--ink)" />
      {/* Two propeller frames swapped by CSS steps: long blades, then short. */}
      <g className={styles.propA} fill="var(--ink)">
        <rect x={0} y={1} width={1} height={3} />
        <rect x={0} y={7} width={1} height={3} />
      </g>
      <g className={styles.propB} fill="var(--ink)">
        <rect x={0} y={4} width={1} height={1} />
        <rect x={0} y={6} width={1} height={1} />
      </g>
    </svg>
  );
}

// The banner is cut into one slice per character so a wave can travel along it like cloth in the
// wind: each slice lags the previous one, and the swing grows from the rope towards the free end.
function Banner({ text }: { text: string }) {
  const chars = Array.from(text);
  return (
    <span className={styles.banner}>
      {chars.map((c, i) => (
        <span
          key={i}
          className={c === "★" ? `${styles.slice} ${styles.star}` : styles.slice}
          style={{ "--i": i, "--amp": Math.min(i / chars.length, 1) } as React.CSSProperties}
        >
          {c === " " ? " " : c}
        </span>
      ))}
      <span className={`${styles.slice} ${styles.tail}`} style={{ "--i": chars.length, "--amp": 1 } as React.CSSProperties} />
    </span>
  );
}

export default function BigNotice({ dict }: { dict: Dictionary["bigNotice"] }) {
  return (
    <section className={styles.notice} role="note" aria-label={dict.title}>
      <p className="sr-only">
        {dict.title} {dict.subtitle}
      </p>
      <div className={styles.sky} aria-hidden="true">
        <div className={styles.flyer}>
          <Plane />
          <span className={styles.rope} />
          <Banner text={`${dict.title} ★ ${dict.subtitle}`} />
        </div>
      </div>
    </section>
  );
}
