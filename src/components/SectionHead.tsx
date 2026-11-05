import type { ReactNode } from "react";
import styles from "./SectionHead.module.css";

export type SectionRole = "progress" | "dev" | "ai" | "community" | "neutral";
export type Source = "author" | "x" | "github" | "ai" | "repost";

/**
 * The one section header used inside a dev card: 8px pixel marker in the section's colour, small
 * caps label, dotted rule filling the line, optional tag and right-hand aside. The rule is the
 * only separator between sections.
 */
export default function SectionHead({
  id,
  role,
  children,
  tag,
  aside,
}: {
  id?: string;
  role: SectionRole;
  children: ReactNode;
  tag?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.head} data-role={role}>
      <h3 id={id} className={styles.label}>
        {children}
      </h3>
      {tag}
      <span className={styles.rule} aria-hidden="true" />
      {aside && <span className={styles.aside}>{aside}</span>}
    </div>
  );
}

/**
 * Provenance tag: always outlined, never filled. Solid border = a primary source (the dev, GitHub);
 * dashed = not confirmed (our AI, someone else's repost), so it reads without colour too.
 */
export function SourceTag({ src, children, title }: { src: Source; children: ReactNode; title?: string }) {
  return (
    <span className={styles.src} data-src={src} title={title}>
      {children}
    </span>
  );
}
