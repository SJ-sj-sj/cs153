export function PillLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pillg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.68 0.22 300)" />
          <stop offset="1" stopColor="oklch(0.62 0.21 250)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-35 32 32)">
        <rect x="8" y="22" width="48" height="20" rx="10" fill="url(#pillg)" />
        <rect x="8" y="22" width="24" height="20" rx="10" fill="oklch(0.97 0.01 280 / 90%)" />
        <rect x="8" y="22" width="48" height="20" rx="10" fill="none" stroke="oklch(0.18 0.03 280)" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
