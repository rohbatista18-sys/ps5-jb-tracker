"use client";

import { useRef, type ReactNode } from "react";
import styles from "./NewsDialog.module.css";

interface Props {
  label: string;
  closeLabel: string;
  count: number | null;
  children?: ReactNode;
}

// Header button that opens the news in a native modal <dialog>: focus is trapped while open,
// Esc closes it, and focus returns to the button. A click on the backdrop also closes it.
export default function NewsDialog({ label, closeLabel, count, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ready = count !== null;

  return (
    <>
      <button
        type="button"
        className={`px-btn ${styles.open}`}
        aria-haspopup="dialog"
        disabled={!ready}
        onClick={() => dialog.current?.showModal()}
      >
        <span aria-hidden="true">▶ </span>
        {label}
        {ready && count > 0 && <span className={styles.count}>{count}</span>}
      </button>

      {ready && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-label={label}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className={styles.panel}>
            <button type="button" className={`px-btn ${styles.close}`} onClick={() => dialog.current?.close()}>
              ✕ {closeLabel}
            </button>
            {children}
          </div>
        </dialog>
      )}
    </>
  );
}
