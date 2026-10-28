"use client";

import { useSyncExternalStore } from "react";
import { INTL_TAG, type Locale } from "@/i18n/config";

const MINUTE = 60_000;

const formatters = new Map<Locale, ReturnType<typeof makeFormatters>>();

function makeFormatters(locale: Locale) {
  const tag = INTL_TAG[locale];
  return {
    absolute: new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }),
    utc: new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }),
    relative: new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" }),
  };
}

function fmt(locale: Locale) {
  let f = formatters.get(locale);
  if (!f) formatters.set(locale, (f = makeFormatters(locale)));
  return f;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * MINUTE],
  ["month", 30 * 24 * 60 * MINUTE],
  ["day", 24 * 60 * MINUTE],
  ["hour", 60 * MINUTE],
  ["minute", MINUTE],
];

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, MINUTE);
  return () => clearInterval(id);
}
// Snapshot changes once per minute, so re-renders are bounded and the value is stable between ticks.
const getMinute = () => Math.floor(Date.now() / MINUTE);
const getServerMinute = () => null;

export function formatRelative(date: Date, now: number, locale: Locale) {
  const { relative } = fmt(locale);
  const diff = date.getTime() - now;
  if (Math.abs(diff) < MINUTE) return relative.format(0, "second");
  const [unit, ms] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
  return relative.format(Math.trunc(diff / ms), unit);
}

interface Props {
  iso: string;
  locale: Locale;
  mode?: "both" | "relative";
  className?: string;
}

export default function RelativeTime({ iso, locale, mode = "both", className }: Props) {
  // null on the server and during hydration → deterministic UTC output, then switches to the viewer's zone.
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;

  const f = fmt(locale);
  const absolute = minute === null ? `${f.utc.format(date)} UTC` : f.absolute.format(date);
  const relative = minute === null ? null : formatRelative(date, minute * MINUTE, locale);

  if (mode === "relative") {
    return (
      <time dateTime={iso} title={absolute} className={className}>
        {relative ?? absolute}
      </time>
    );
  }

  return (
    <time dateTime={iso} title={iso} className={className}>
      <span data-part="absolute">{absolute}</span>
      {relative && <span data-part="relative">{relative}</span>}
    </time>
  );
}
