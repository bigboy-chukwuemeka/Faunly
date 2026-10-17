import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { getPushConfig, savePushDevice, removePushDevice, sendTestPush } from '../lib/pushApi'
import {
  pushSupport,
  getCurrentSubscription,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '../lib/pushClient'

// Turns an error (string, Error, object) into readable text.
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

// The "Notifications" row on the Profile page: turn notifications on or off for THIS device,
// and send a test notification.
export default function NotificationsRow() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = useState('checking') // 'checking' | 'unsupported' | 'blocked' | 'off' | 'on'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function check() {
      const support = pushSupport()
      if (!support.ok) {
        if (!cancelled) {
          setState('unsupported')
          setReason(support.reason)
        }
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked')
        return
      }
      try {
        const subscription = await getCurrentSubscription()
        if (cancelled) return
        if (subscription && Notification.permission === 'granted') {
          setState('on')
          // Keep the server's copy of this device up to date.
          if (user) {
            const res = await savePushDevice(subscription.toJSON())
            if (!cancelled && res.error) {
              setError(`Could not update this device on the server: ${errorText(res.error)}`)
            }
          }
        } else {
          setState('off')
        }
      } catch (e) {
        if (!cancelled) {
          setState('off')
          setError(errorText(e))
        }
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleTurnOn() {
    setError('')
    setMessage('')
    setBusy('Turning on...')
    try {
      const subscription = await subscribeThisDevice(async () => {
        const config = await getPushConfig()
        if (config.error) throw new Error(errorText(config.error))
        return config.vapid_public_key
      })

      const res = await savePushDevice(subscription.toJSON())
      if (res.error) {
        // Undo the local subscription so this device and the server agree.
        let undoNote = ''
        try {
          await subscription.unsubscribe()
        } catch (undoError) {
          undoNote = ` (and this device could not be reset: ${errorText(undoError)})`
        }
        throw new Error(`${errorText(res.error)}${undoNote}`)
      }

      setState('on')
      setMessage('Notifications are on for this device. Tap "Send test" to check.')
    } catch (e) {
      setError(errorText(e))
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setState('blocked')
    }
    setBusy('')
  }

  async function handleTurnOff() {
    setError('')
    setMessage('')
    setBusy('Turning off...')
    try {
      const endpoint = await unsubscribeThisDevice()
      if (endpoint) {
        const res = await removePushDevice(endpoint)
        if (res.error) throw new Error(`Turned off on this device, but the server could not forget it: ${errorText(res.error)}`)
      }
      setState('off')
      setMessage('Notifications are off for this device.')
    } catch (e) {
      setError(errorText(e))
    }
    setBusy('')
  }

  async function handleTest() {
    setError('')
    setMessage('')
    setBusy('Sending...')
    try {
      const res = await sendTestPush()
      if (res.error) throw new Error(errorText(res.error))

      const failedDetails = (res.failed || [])
        .map((f) => `${f.status || 'error'}: ${f.message}`)
        .join('; ')

      if (res.sent > 0) {
        setMessage(
          `Test sent to ${res.sent} device${res.sent === 1 ? '' : 's'}. It should appear in a few seconds.` +
            (failedDetails ? ` Some failed: ${failedDetails}` : '')
        )
      } else {
        throw new Error(`The test could not be delivered. ${failedDetails}`)
      }
    } catch (e) {
      setError(errorText(e))
    }
    setBusy('')
  }

  let sub
  if (authLoading || state === 'checking') sub = 'Checking...'
  else if (!user) sub = 'Sign in to turn on notifications'
  else if (state === 'unsupported') sub = reason
  else if (state === 'blocked') sub = 'Blocked. Allow notifications for Faunly in your browser or phone settings, then come back.'
  else if (state === 'on') sub = 'On for this device'
  else sub = 'Get your reminders on this device'

  const buttonClass = 'px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50'

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
          <Bell size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--surface-text)]">Notifications</p>
          <p className="text-xs text-[var(--surface-text-muted)] break-words">{sub}</p>
        </div>
      </div>

      {!authLoading && !user && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className={`${buttonClass} bg-[var(--accent)] text-[var(--bg)]`}
          >
            Sign in
          </button>
        </div>
      )}

      {user && state === 'off' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleTurnOn}
            disabled={Boolean(busy)}
            className={`${buttonClass} bg-[var(--accent)] text-[var(--bg)]`}
          >
            {busy || 'Turn on'}
          </button>
        </div>
      )}

      {user && state === 'on' && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={Boolean(busy)}
            className={`${buttonClass} bg-[var(--accent)] text-[var(--bg)]`}
          >
            {busy === 'Sending...' ? busy : 'Send test'}
          </button>
          <button
            type="button"
            onClick={handleTurnOff}
            disabled={Boolean(busy)}
            className={`${buttonClass} border border-[var(--border)] text-[var(--surface-text)]`}
          >
            {busy === 'Turning off...' ? busy : 'Turn off'}
          </button>
        </div>
      )}

      {message && <p className="text-xs text-[var(--accent-green)] mt-3 break-words">{message}</p>}
      {error && <p className="text-xs text-[var(--error)] mt-3 break-words">{error}</p>}
    </div>
  )
}