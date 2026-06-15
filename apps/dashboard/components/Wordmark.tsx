export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-sans text-sm font-semibold tracking-tight text-text">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="4" stroke="#2EE6A6" strokeWidth="1.5" />
        <path d="M7 12.5l3 3L17 8" stroke="#2EE6A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Agent<span className="text-verified">Trace</span>
    </span>
  );
}
