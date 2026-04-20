export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      {/* Decorative brand gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_10%,theme(colors.brand.200/50),transparent_60%),radial-gradient(40%_40%_at_80%_0%,theme(colors.brand.300/40),transparent_60%),radial-gradient(50%_50%_at_50%_100%,theme(colors.brand.100/60),transparent_70%)]"
      />
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  )
}
