// Icon SVG tự vẽ, nét 1.75 thống nhất — thay emoji (checklist redesign: emoji
// icon là dấu vân tay AI). Kích thước điều khiển bằng className.
type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function IconShield({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-2.8 7.6-7 9.5C7.8 18.6 5 15.4 5 11V6l7-3z" />
      <path d="M9.5 11.5l2 2 3.5-4" />
    </svg>
  );
}

export function IconClock({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconAsk({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4.5 6.5h11a2 2 0 012 2v5a2 2 0 01-2 2H9l-4.5 3v-3h0a2 2 0 01-2-2v-5a2 2 0 012-2z" />
      <path d="M19.5 10.5h.5a2 2 0 012 2v3.5a2 2 0 01-2 2h-.5v2.5l-2.5-1.7" />
    </svg>
  );
}

export function IconCalc({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5v.01" />
    </svg>
  );
}

export function IconChart({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 4v16h16" />
      <path d="M8 15v-4M12 15V8M16 15v-6" />
    </svg>
  );
}

export function IconHeart({ className, filled }: P & { filled?: boolean }) {
  return (
    <svg {...base} className={className} fill={filled ? "currentColor" : "none"} aria-hidden>
      <path d="M12 20s-7-4.6-9-9c-1.2-2.7.5-5.8 3.4-6.4 1.9-.4 3.9.5 5.6 2.6 1.7-2.1 3.7-3 5.6-2.6C20.5 5.2 22.2 8.3 21 11c-2 4.4-9 9-9 9z" />
    </svg>
  );
}

// Bộ icon thông số căn — theo hàng meta của card Veedoo (loại · diện tích · PN)
export function IconPin({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 21s6.5-5.7 6.5-10a6.5 6.5 0 10-13 0c0 4.3 6.5 10 6.5 10z" />
      <circle cx="12" cy="10.8" r="2.4" />
    </svg>
  );
}

export function IconHouse({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 10.6L12 4l8 6.6" />
      <path d="M6 9.8V19h12V9.8" />
    </svg>
  );
}

export function IconArea({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
    </svg>
  );
}

export function IconBed({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M3 18v-8M3 13h18v5M21 18v-3" />
      <path d="M7 13v-2.5a1.5 1.5 0 011.5-1.5h8A1.5 1.5 0 0118 10.5V13" />
    </svg>
  );
}

export function IconSearch({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L20 20" />
    </svg>
  );
}
