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

export function listHealthRecords(animalId) {
  return callFunction({ task: 'list_health_records', animal_id: animalId })
}

export function createHealthRecord(animalId, fields) {
  return callFunction({ task: 'create_health_record', animal_id: animalId, ...fields })
}

export function deleteHealthRecord(animalId, recordId) {
  return callFunction({ task: 'delete_health_record', animal_id: animalId, record_id: recordId })
}
