import { getGuestSessionId } from './guestSession'
import { getAuthHeader } from './auth'

const ENDPOINT = 'https://wlgjtfqgmfgbhmjmsadr.supabase.co/functions/v1/super-service'

async function callFunction(payload) {
  const authHeader = await getAuthHeader()
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guest_session_id: getGuestSessionId(), ...payload }),
  })
  return res.json()
}

export function listIdentifications() {
  return callFunction({ task: 'list_identifications' })
}

export function listConversations() {
  return callFunction({ task: 'list_conversations' })
}

export function getConversation(conversationId) {
  return callFunction({ task: 'get_conversation', conversation_id: conversationId })
}
