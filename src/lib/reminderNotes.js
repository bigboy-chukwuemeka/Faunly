import { createHealthRecord } from './healthRecordsApi'

// Reminder types that can be saved as a note when they are marked done.
// (A vet visit reminder becomes a Vet visit note, a medicine reminder becomes a Medicine note.)
const NOTE_TYPE_FOR_REMINDER = {
  vet_visit: 'vet_visit',
  medication: 'medication',
}

const WHY_WORDS = ['Checkup', 'Vaccine', 'Sick', 'Follow-up', 'Other']

// Turns a reminder into the pieces of a matching note.
// Returns null when this kind of reminder is not saved as a note.
export function noteFromReminder(reminder) {
  const recordType = NOTE_TYPE_FOR_REMINDER[reminder?.reminder_type]
  if (!recordType) return null

  if (recordType === 'vet_visit') {
    // A vet reminder keeps its detail as "Checkup · Greenfield Clinic".
    // The note shows the reason as its title and the clinic as its detail.
    const description = reminder.description || ''
    const parts = description.split(' · ')
    if (WHY_WORDS.includes(parts[0])) {
      return {
        record_type: 'vet_visit',
        title: parts[0],
        description: parts.slice(1).join(' · ') || null,
      }
    }
    return {
      record_type: 'vet_visit',
      title: reminder.title || 'Vet visit',
      description: description || null,
    }
  }

  return {
    record_type: 'medication',
    title: reminder.title,
    description: reminder.description || null,
  }
}

function localYmd(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Creates the note. Throws an Error with a readable message if it fails.
export async function saveReminderAsNote(reminder) {
  const note = noteFromReminder(reminder)
  if (!note) throw new Error('This kind of reminder cannot be saved as a note.')
  if (!reminder.animal_id) throw new Error('This reminder is not linked to an animal.')

  const now = new Date()
  const res = await createHealthRecord(reminder.animal_id, {
    ...note,
    record_date: localYmd(now),
    happened_at: now.toISOString(),
  })

  if (res.error) {
    throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error))
  }
  return res.record
}
