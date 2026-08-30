export function GlassBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute -left-32 -top-36 h-[420px] w-[420px] rounded-full bg-[var(--color-primary)] opacity-55 blur-[70px]" />
      <div className="pointer-events-none absolute -right-40 top-44 h-[380px] w-[380px] rounded-full bg-[var(--color-primary)] opacity-40 blur-[80px]" />
      <div className="pointer-events-none absolute -left-24 -bottom-28 h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-35 blur-[80px]" />
    </>
  )
}
