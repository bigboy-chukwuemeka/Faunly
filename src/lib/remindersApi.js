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

export function listReminders({ animal_id, status } = {}) {
  return call('list_reminders', { animal_id, status })
}

export function getReminder(reminder_id) {
  return call('get_reminder', { reminder_id })
}

export function createReminder(data) {
  return call('create_reminder', data)
}

export function updateReminder(data) {
  return call('update_reminder', data)
}

export function completeReminder(reminder_id) {
  return call('complete_reminder', { reminder_id })
}

export function deleteReminder(reminder_id) {
  return call('delete_reminder', { reminder_id })
}
