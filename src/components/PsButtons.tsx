// The four PlayStation face-button symbols as SVG, so every glyph has the same size on every OS
// (the Unicode △○✕□ come from different fallback fonts and render at different sizes).
const SHAPES = {
  triangle: <path d="M12 4 21 19H3Z" />,
  circle: <circle cx="12" cy="12" r="8" />,
  cross: <path d="M5 5 19 19M19 5 5 19" />,
  square: <rect x="4.5" y="4.5" width="15" height="15" />,
} as const;

export default function PsButtons({ className }: { className?: string }) {
  return (
    <p className={className} aria-hidden="true">
      {(Object.keys(SHAPES) as (keyof typeof SHAPES)[]).map((b) => (
        <svg key={b} data-b={b} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
          {SHAPES[b]}
        </svg>
      ))}
    </p>
  );
}
