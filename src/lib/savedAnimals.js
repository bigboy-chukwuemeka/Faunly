const KEY = 'faunly_saved_animals'

export function getSavedAnimals() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function isAnimalSaved(animal) {
  return getSavedAnimals().some((a) => a.common_name === animal.common_name)
}

export function saveAnimal(animal) {
  if (isAnimalSaved(animal)) return getSavedAnimals()
  const updated = [{ ...animal, savedAt: new Date().toISOString() }, ...getSavedAnimals()]
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}
