import BottomNav from './BottomNav'

export default function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6 text-center pb-24">
      <h1 className="font-display text-2xl mb-2">{title}</h1>
      <p className="text-[var(--text-muted)]">Coming soon.</p>
      <BottomNav />
    </div>
  )
}
