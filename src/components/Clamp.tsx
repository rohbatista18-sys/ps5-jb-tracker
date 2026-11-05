"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Clamp.module.css";

interface Props {
  lines: number;
  more: string;
  less: string;
  children: ReactNode;
  className?: string;
  /** Only clamp below 760px (the desktop layout has room for the full text). */
  mobileOnly?: boolean;
}

/** Clamps text to N lines with a "Read more" toggle that only shows when the text overflows. */
export default function Clamp({ lines, more, less, children, className, mobileOnly }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  return (
    <div className={className}>
      <div
        ref={box}
        className={`${styles.text} ${mobileOnly ? styles.mobileOnly : ""}`}
        data-open={open || undefined}
        style={{ "--lines": lines } as React.CSSProperties}
      >
        {children}
      </div>
      {(overflows || open) && (
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
