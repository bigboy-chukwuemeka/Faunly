import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Syringe, Pill, Stethoscope, Calendar, PawPrint, Clock,
  CheckCircle2, Pencil, Trash2, ChevronRight,
} from 'lucide-react'
import { getReminder, completeReminder, deleteReminder } from '../lib/remindersApi'
import BottomNav from '../components/BottomNav'
import FollowUpCard from '../components/FollowUpCard'
import { noteFromReminder, saveReminderAsNote } from '../lib/reminderNotes'

const TYPE_ICON = {
  vaccination: <Syringe size={20} />,
  medication: <Pill size={20} />,
  vet_visit: <Stethoscope size={20} />,
  follow_up: <Calendar size={20} />,
  weight_check: <PawPrint size={20} />,
  custom: <Clock size={20} />,
}

const TYPE_LABEL = {
  vaccination: 'Vaccination Due',
  medication: 'Medication Reminder',
  vet_visit: 'Vet Check-up',
  follow_up: 'Follow-up Reminder',
  weight_check: 'Weight Check',
  custom: 'Reminder',
}

function daysUntil(dateStr) {
  const due = new Date(dateStr)
  const now = new Date()
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

// Shows the age the way the profile does: "about 4 years".
function formatAge(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (/^\d+(\.\d+)?$/.test(text)) {
    return `about ${text} ${Number(text) === 1 ? 'year' : 'years'}`
  }
  if (/^\d/.test(text)) return `about ${text}`
  return text
}

function Badge({ days }) {
  if (days < 0) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--error)]/20 text-[var(--error)]">
        Overdue
      </span>
    )
  }
  if (days === 0) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
        Today
      </span>
    )
  }
  if (days <= 3) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
        In {days} day{days > 1 ? 's' : ''}
      </span>
    )
  }
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)]">
      In {days} days
    </span>
  )
}

// Which set of details a reminder type uses (same grouping as the Add reminder screen).
function kindOf(type) {
  if (type === 'vet_visit') return 'vet'
  if (type === 'medication') return 'medicine'
  if (type === 'vaccination') return 'vaccine'
  return 'other'
}

const KIND_LABEL = {
  vaccination: 'Vaccine or preventive',
  medication: 'Medicine',
  vet_visit: 'Vet visit',
  follow_up: 'Follow-up',
  weight_check: 'Weight check',
  custom: 'Custom',
}

const WHY_WORDS = ['Checkup', 'Vaccine', 'Sick', 'Follow-up', 'Other']

// A vet reminder's short detail is saved as "Checkup · Greenfield Clinic".
// This splits it back into the reason and the clinic. Anything else is left as plain details.
function splitVetDescription(description) {
  if (!description) return { why: '', clinic: '', other: '' }
  const parts = description.split(' · ')
  if (WHY_WORDS.includes(parts[0])) {
    return { why: parts[0], clinic: parts.slice(1).join(' · '), other: '' }
  }
  return { why: '', clinic: '', other: description }
}

function longWhen(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'No date set'
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-[var(--surface-text-muted)] flex-shrink-0">{label}</span>
      <span className="text-sm text-[var(--surface-text)] text-right break-words min-w-0">{value}</span>
    </div>
  )
}

const REPEAT_LABEL = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

const NOTIFY_LABEL = {
  on_day: 'On the day',
  '1_day': '1 day before',
  '3_days': '3 days before',
  '1_week': '1 week before',
}

function repeatText(reminder) {
  if (!reminder.repeat_kind || reminder.repeat_kind === 'never') return ''
  if (reminder.repeat_kind === 'custom') {
    return `Every ${reminder.repeat_every} ${reminder.repeat_unit}`
  }
  return REPEAT_LABEL[reminder.repeat_kind] || ''
}

// "YYYY-MM-DD" -> "Wed, 7 Oct 2026"
function longDay(ymd) {
  if (!ymd) return ''
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return String(ymd)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReminderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Set when we were opened from an animal's Reminders tab, so we can return there.
  const fromAnimalId = location.state?.from_animal_id || null
  const [reminder, setReminder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [askSaveNote, setAskSaveNote] = useState(false)

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

  function goBackToList() {
    if (fromAnimalId) {
      navigate(`/animals/${fromAnimalId}`, { state: { tab: 'reminders' } })
    } else {
      navigate('/reminders')
    }
  }

  useEffect(() => {
    loadReminder()
  }, [id])

  async function loadReminder() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getReminder(id)
      if (res.error) {
        setLoadError(errorText(res.error))
      } else if (res.reminder) {
        setReminder(res.reminder)
      } else {
        setLoadError('The server did not return a reminder for this ID.')
      }
    } catch (e) {
      setLoadError(errorText(e))
    }
    setLoading(false)
  }

  async function handleMarkDone() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await completeReminder(id)
      if (res.error) {
        setActionError(`Could not mark this reminder as done: ${errorText(res.error)}`)
        setBusy(false)
        return
      }
    } catch (e) {
      setActionError(`Could not mark this reminder as done: ${errorText(e)}`)
      setBusy(false)
      return
    }
    setBusy(false)
    if (noteFromReminder(reminder)) setAskSaveNote(true)
    loadReminder()
  }

  async function handleDelete(scope) {
    const question =
      scope === 'series'
        ? 'Delete this reminder and all its repeats? Reminders already marked done are kept. This cannot be undone.'
        : 'Delete this reminder? This cannot be undone.'
    if (!window.confirm(question)) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await deleteReminder(id, scope)
      if (res.error) {
        setActionError(`Could not delete this reminder: ${errorText(res.error)}`)
        setBusy(false)
        return
      }
    } catch (e) {
      setActionError(`Could not delete this reminder: ${errorText(e)}`)
      setBusy(false)
      return
    }
    goBackToList()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!reminder) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-2">Reminder not found.</p>
        {loadError && <p className="mb-4 text-sm text-[var(--error)] break-words">{loadError}</p>}
        <button onClick={goBackToList} className="text-[var(--accent)] underline">
          Back to Reminders
        </button>
      </div>
    )
  }

  const days = daysUntil(reminder.due_at)
  const animal = reminder.animals
  const typeLabel = TYPE_LABEL[reminder.reminder_type] || 'Reminder'
  const isDone = reminder.status === 'completed'

  // ----- Summary pieces, built only from what is saved on the reminder -----
  const animalName = animal?.name || 'the animal'
  const kind = kindOf(reminder.reminder_type)
  const whenText = longWhen(reminder.due_at)
  const isDismissed = reminder.status === 'dismissed'
  const isOverdue = !isDone && !isDismissed && days < 0
  const statusText = isDone ? 'Done' : isDismissed ? 'Dismissed' : isOverdue ? 'Overdue' : 'Upcoming'

  const vet = kind === 'vet' ? splitVetDescription(reminder.description) : null

  let sentence
  if (kind === 'vet') {
    sentence = `Take ${animalName} to the vet on ${whenText}.`
    if (vet.why) sentence += ` Reason: ${vet.why}.`
    if (vet.clinic) sentence += ` Clinic: ${vet.clinic}.`
  } else if (kind === 'medicine') {
    sentence = reminder.description
      ? `Give ${animalName} ${reminder.description} of ${reminder.title}, starting ${whenText}.`
      : `Give ${animalName} ${reminder.title}, starting ${whenText}.`
  } else if (kind === 'vaccine') {
    sentence = `${reminder.title} is due for ${animalName} on ${whenText}.`
  } else {
    sentence = `${reminder.title} for ${animalName} on ${whenText}.`
  }
  if (kind === 'medicine' && reminder.last_day) sentence = sentence.replace(/\.$/, `, until ${longDay(reminder.last_day)}.`)
  const repeatLabel = repeatText(reminder)
  if (repeatLabel) sentence += ` Repeats: ${repeatLabel.toLowerCase()}.`
  if (isDone) sentence += ' This has been marked as done.'
  else if (isOverdue) sentence += ' This is overdue.'

  const detailRows = [{ label: 'Kind', value: KIND_LABEL[reminder.reminder_type] || 'Reminder' }]
  if (kind === 'vet') {
    if (vet.why) detailRows.push({ label: 'Why', value: vet.why })
    if (vet.clinic) detailRows.push({ label: 'Clinic', value: vet.clinic })
    if (vet.other) detailRows.push({ label: 'Details', value: vet.other })
  } else if (kind === 'medicine') {
    detailRows.push({ label: 'Medicine', value: reminder.title })
    if (reminder.description) detailRows.push({ label: 'How much', value: reminder.description })
  } else if (kind === 'vaccine') {
    detailRows.push({ label: 'What', value: reminder.title })
    if (reminder.description) detailRows.push({ label: 'Details', value: reminder.description })
  } else if (reminder.description) {
    detailRows.push({ label: 'Details', value: reminder.description })
  }
  if (kind === 'vet' && reminder.clinic_phone) {
    detailRows.push({
      label: 'Clinic phone',
      value: (
        <a href={`tel:${reminder.clinic_phone}`} className="text-[var(--accent)] underline">
          {reminder.clinic_phone}
        </a>
      ),
    })
  }
  detailRows.push({
    label: kind === 'medicine' ? 'Start day' : kind === 'vaccine' ? 'Next due' : 'When',
    value: whenText,
  })
  if (kind === 'medicine' && reminder.last_day) {
    detailRows.push({ label: 'Last day', value: longDay(reminder.last_day) })
  }
  if (repeatLabel) detailRows.push({ label: 'Repeats', value: repeatLabel })
  const notifyChoices = (reminder.notify_offsets || []).map((v) => NOTIFY_LABEL[v] || v)
  if (notifyChoices.length > 0) detailRows.push({ label: 'Notify me', value: notifyChoices.join(', ') })
  detailRows.push({ label: 'Status', value: statusText })
  if (reminder.created_at) {
    detailRows.push({
      label: 'Added on',
      value: new Date(reminder.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl">Reminder Details</h1>
        <div className="w-9" />
      </div>

      <div className="px-6 space-y-4">
        {/* Summary card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
              {TYPE_ICON[reminder.reminder_type] || <Clock size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-[var(--surface-text)] break-words">
                  {reminder.title || typeLabel}
                </p>
                {isDone ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)] flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 size={12} /> Done
                  </span>
                ) : (
                  <span className="flex-shrink-0">
                    <Badge days={days} />
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--surface-text-muted)] mt-2 leading-relaxed">{sentence}</p>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4">
          <h3 className="font-medium pt-4 pb-1 text-[var(--surface-text)]">Details</h3>
          <div className="divide-y divide-[var(--border)]">
            {detailRows.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>

        {notifyChoices.length > 0 && (
          <p className="text-xs text-[var(--text-muted)] px-1">
            Your notify choices are saved. Phone notifications are not switched on yet.
          </p>
        )}

        {/* Animal card */}
        {animal && (
          <button
            onClick={() => navigate(`/animals/${animal.id}`)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 text-left"
          >
            <div className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden flex-shrink-0">
              <PawPrint size={18} className="text-[var(--surface-text-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--surface-text)]">{animal.name}</p>
              <p className="text-xs text-[var(--surface-text-muted)]">
                {animal.attributes?.breed || animal.species_label}
                {animal.estimated_age ? ` • ${formatAge(animal.estimated_age)}` : ''}
                {animal.sex ? ` • ${animal.sex}` : ''}
              </p>
            </div>
            <ChevronRight size={18} className="text-[var(--surface-text-muted)] flex-shrink-0" />
          </button>
        )}

        {/* Notes */}
        {reminder.notes && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            <h3 className="font-medium mb-1 text-[var(--surface-text)]">Notes</h3>
            <p className="text-sm text-[var(--surface-text-muted)]">{reminder.notes}</p>
          </div>
        )}

        {askSaveNote && (
          <FollowUpCard
            question={`Save this in ${animal?.name || 'the animal'}'s notes?`}
            detail="This adds a matching note to the health notes."
            yesLabel="Yes, save it"
            onYes={() => saveReminderAsNote(reminder)}
            successText={`Saved in ${animal?.name || 'the animal'}'s notes.`}
            onClose={() => setAskSaveNote(false)}
          />
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {actionError && (
            <p className="text-sm text-[var(--error)] break-words">{actionError}</p>
          )}
          {!isDone && (
            <button
              onClick={handleMarkDone}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] font-medium rounded-full py-3.5 disabled:opacity-50"
            >
              <CheckCircle2 size={18} /> Mark as Done
            </button>
          )}
          <button
            onClick={() => navigate('/reminders/add', { state: { editReminder: reminder, from_animal_id: fromAnimalId } })}
            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] font-medium rounded-full py-3.5"
          >
            <Pencil size={16} /> Edit Reminder
          </button>
          <button
            onClick={() => handleDelete('this')}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 text-[var(--error)] font-medium py-2 disabled:opacity-50"
          >
            <Trash2 size={16} /> {reminder.series_id ? 'Delete this reminder only' : 'Delete Reminder'}
          </button>
          {reminder.series_id && (
            <button
              onClick={() => handleDelete('series')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 text-[var(--error)] font-medium py-2 disabled:opacity-50"
            >
              <Trash2 size={16} /> Delete all repeats
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
