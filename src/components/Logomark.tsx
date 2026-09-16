export function Logomark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="22" cy="25" r="16" fill="oklch(100% 0 0 / 0.55)" />
      <circle cx="35" cy="19" r="11" fill="oklch(100% 0 0 / 0.4)" />
      <circle cx="29" cy="35" r="9" fill="oklch(100% 0 0 / 0.3)" />
      <circle cx="25" cy="27" r="5.5" fill="var(--color-primary)" />
    </svg>
  )
}
