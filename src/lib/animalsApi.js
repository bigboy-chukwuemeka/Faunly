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

export function listAnimals() {
  return callFunction({ task: 'list_animals' })
}

export function getAnimal(animalId) {
  return callFunction({ task: 'get_animal', animal_id: animalId })
}

export function createAnimal(fields) {
  return callFunction({ task: 'create_animal', ...fields })
}

export function updateAnimal(animalId, fields) {
  return callFunction({ task: 'update_animal', animal_id: animalId, ...fields })
}

export function deleteAnimal(animalId) {
  return callFunction({ task: 'delete_animal', animal_id: animalId })
}

export function migrateGuest() {
  return callFunction({ task: 'migrate_guest' })
}
