// One place for the safety line, so it reads the same everywhere.
export const DISCLAIMER_TEXT = 'This app is not a vet and does not diagnose.'

export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-[var(--text-muted)] text-center ${className}`}>
      {DISCLAIMER_TEXT}
    </p>
  )
}
