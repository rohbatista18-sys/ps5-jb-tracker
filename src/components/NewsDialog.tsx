"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./NewsDialog.module.css";

interface Props {
  label: string;
  closeLabel: string;
  /** Item count shown as a badge; null while loading (button disabled). */
  count: number | null;
  /** id of the visible heading inside `children`, used as the dialog's accessible name. */
  titleId?: string;
  children?: ReactNode;
}

// Header button that opens the content in a native modal <dialog>: focus is trapped while open,
// Esc closes it, and focus returns to the button. A click on the backdrop also closes it.
export default function NewsDialog({ label, closeLabel, count, titleId, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const ready = count !== null;

  return (
    <>
      <button
        type="button"
        className={`px-btn ${styles.open}`}
        aria-haspopup="dialog"
        aria-controls={ready ? dialogId : undefined}
        aria-expanded={ready ? open : undefined}
        aria-busy={!ready || undefined}
        disabled={!ready}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <span aria-hidden="true">▶ </span>
        {label}
        {ready ? (
          count > 0 && <span className={styles.count}>{count}</span>
        ) : (
          <span aria-hidden="true">…</span>
        )}
      </button>

      {ready && (
        <dialog
          ref={dialog}
          id={dialogId}
          className={styles.dialog}
          aria-labelledby={titleId}
          aria-label={titleId ? undefined : label}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className={styles.panel}>
            <button type="button" className={`px-btn ${styles.close}`} onClick={() => dialog.current?.close()}>
              <span aria-hidden="true">✕ </span>
              {closeLabel}
            </button>
            {children}
          </div>
        </dialog>
      )}
    </>
  );
}
