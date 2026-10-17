import { getAuthHeader } from './auth'
import { getGuestSessionId } from './guestSession'

const FUNCTION_URL = 'https://wlgjtfqgmfgbhmjmsadr.supabase.co/functions/v1/super-service'

async function call(task, extra = {}) {
  const authHeader = await getAuthHeader()
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      guest_session_id: getGuestSessionId(),
      ...extra,
    }),
  })
  return res.json()
}

// The public key the browser needs to subscribe to notifications.
export function getPushConfig() {
  return call('push_config')
}

// Saves this phone or computer so the server can send it notifications.
export function savePushDevice(subscription) {
  return call('push_subscribe', { subscription, user_agent: navigator.userAgent })
}

// Forgets this phone or computer.
export function removePushDevice(endpoint) {
  return call('push_unsubscribe', { endpoint })
}

// Sends a test notification to every device saved for this account.
export function sendTestPush() {
  return call('push_test')
}