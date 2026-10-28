"use client";

import { useEffect, useState } from "react";

interface Props {
  value: string;
  ariaLabel: string;
  text: { copy: string; copied: string; copiedSr: string; error: string; errorSr: string };
  className?: string;
}

async function copy(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy failed");
}

export default function CopyButton({ value, ariaLabel, text, className }: Props) {
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <button
      type="button"
      className={className}
      title={value}
      aria-label={ariaLabel}
      onClick={() => copy(value).then(() => setState("ok"), () => setState("error"))}
    >
      <span aria-hidden="true">{state === "ok" ? text.copied : state === "error" ? text.error : text.copy}</span>
      <span className="sr-only" aria-live="polite">
        {state === "ok" ? text.copiedSr : state === "error" ? text.errorSr : ""}
      </span>
    </button>
  );
}
