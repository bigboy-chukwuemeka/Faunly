import { useEffect, useRef, useState } from 'react'

const ASK_SECONDS = 20
const DONE_SECONDS = 6

function errorText(err) {
  if (!err) return 'Unknown error (no details were returned).'
  if (typeof err === 'string') return err
  if (err.message) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error (could not read the error details).'
  }
}

// A small, optional question card: "Save this in Bella's notes?" / "Set a reminder?"
// - onYes does the work and must throw an Error if it fails (the message is shown).
// - If nobody answers, the card goes away by itself. It never blocks anything.
export default function FollowUpCard({
  question,
  detail,
  yesLabel = 'Yes',
  noLabel = 'No thanks',
  onYes,
  successText,
  onClose,
}) {
  const [status, setStatus] = useState('ask') // 'ask' | 'saving' | 'done'
  const [error, setError] = useState('')

  // Keep the latest onClose without restarting the timer every time the parent re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Goes away on its own if ignored (and shortly after saying yes).
  useEffect(() => {
    if (status === 'saving') return undefined
    const seconds = status === 'done' ? DONE_SECONDS : ASK_SECONDS
    const timer = setTimeout(() => closeRef.current(), seconds * 1000)
    return () => clearTimeout(timer)
  }, [status])

  async function handleYes() {
    setError('')
    setStatus('saving')
    try {
      await onYes()
      setStatus('done')
    } catch (e) {
      setError(errorText(e))
      setStatus('ask')
    }
  }

  if (status === 'done') {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3">
        <p className="text-sm text-[var(--accent-green)] font-medium">{successText}</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="font-medium text-[var(--surface-text)]">{question}</p>
      {detail && <p className="text-sm text-[var(--surface-text-muted)] mt-0.5 break-words">{detail}</p>}

      {error && <p className="text-sm text-[var(--error)] mt-2 break-words">{error}</p>}

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleYes}
          disabled={status === 'saving'}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--bg)] text-sm font-medium disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : error ? 'Try again' : yesLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={status === 'saving'}
          className="px-3 py-2 text-sm text-[var(--surface-text-muted)] disabled:opacity-50"
        >
          {noLabel}
        </button>
      </div>
    </div>
  )
}
