import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { listAnimals } from '../lib/animalsApi'
import { createReminder, updateReminder } from '../lib/remindersApi'
import BottomNav from '../components/BottomNav'

// "What is this reminder for?" chips. The values are the types the app already saves.
const TYPE_CHIPS = [
  { value: 'vaccination', label: 'Vaccine' },
  { value: 'medication', label: 'Medicine' },
  { value: 'vet_visit', label: 'Vet visit' },
  { value: 'custom', label: 'Custom' },
]

// Labels for older reminders whose type is no longer one of the four chips.
const OLD_TYPE_LABEL = {
  follow_up: 'Follow-up',
  weight_check: 'Weight check',
}

// Which set of extra boxes a reminder type uses.
function kindOf(type) {
  if (type === 'vet_visit') return 'vet'
  if (type === 'medication') return 'medicine'
  if (type === 'vaccination') return 'vaccine'
  return 'other'
}

// Vet: "Why?" chips
const WHY_CHIPS = ['Checkup', 'Vaccine', 'Sick', 'Follow-up', 'Other']

// The date box is named differently for each kind.
const DATE_LABEL = {
  vet: 'Date & time',
  medicine: 'Start day',
  vaccine: 'Next due day',
  other: 'Date & time',
}

const REPEAT_CHIPS = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
]

const CUSTOM_UNITS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
]

const NOTIFY_CHIPS = [
  { value: 'on_day', label: 'On the day' },
  { value: '1_day', label: '1 day before' },
  { value: '3_days', label: '3 days before' },
  { value: '1_week', label: '1 week before' },
]

const DEFAULT_TIME = '09:00'

const INPUT_CLASS =
  'w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none'

// iPhone Safari draws date and time boxes wider than the screen unless they are told
// to use the normal box width. These settings stop that.
const DATE_INPUT_STYLE = {
  WebkitAppearance: 'none',
  appearance: 'none',
  display: 'block',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  minHeight: 52,
  textAlign: 'left',
}

const DATE_INPUT_CSS = `
  input[type="date"]::-webkit-date-and-time-value,
  input[type="time"]::-webkit-date-and-time-value {
    text-align: left;
    min-width: 0;
  }
`

function pad(n) {
  return String(n).padStart(2, '0')
}

// "YYYY-MM-DDTHH:mm" in the phone's local time.
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Turns whatever came back (string, Error, object) into readable text.
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

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm border ${
        selected
          ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)] font-medium'
          : 'bg-[var(--input-bg)] text-[var(--text)] border-[var(--border)]'
      }`}
    >
      {children}
    </button>
  )
}

function Label({ children }) {
  return <label className="block text-sm text-[var(--text-muted)] mb-2">{children}</label>
}

function Hint({ children }) {
  return <p className="text-xs text-[var(--text-muted)] mt-2">{children}</p>
}

export default function AddReminder() {
  const navigate = useNavigate()
  const location = useLocation()
  const editReminder = location.state?.editReminder || null
  const preselectedAnimalId = location.state?.animal_id || editReminder?.animal_id || ''
  // Set when we were opened from an animal's Reminders tab, so we can return there.
  const fromAnimalId = location.state?.from_animal_id || null

  const editParts = editReminder?.due_at ? toDatetimeLocal(editReminder.due_at).split('T') : null
  const editKind = editReminder ? kindOf(editReminder.reminder_type) : null
  const editTitle = editReminder?.title || ''
  const editDescription = editReminder?.description || ''

  // When editing a vet reminder, "Checkup · Greenfield Clinic" is split back into its two boxes.
  let initialWhy = ''
  let initialClinic = ''
  if (editKind === 'vet' && editDescription) {
    const parts = editDescription.split(' · ')
    if (WHY_CHIPS.includes(parts[0])) {
      initialWhy = parts[0]
      initialClinic = parts.slice(1).join(' · ')
    }
  }

  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    animal_id: preselectedAnimalId,
    reminder_type: editReminder?.reminder_type || 'vaccination',
    notes: editReminder?.notes || '',
  })
  const [date, setDate] = useState(editParts ? editParts[0] : todayLocal())
  const [addTime, setAddTime] = useState(Boolean(editParts))
  const [time, setTime] = useState(editParts ? editParts[1] : DEFAULT_TIME)

  // Extra boxes. Each kind keeps its own values, so switching kinds does not lose what you typed.
  const [vetWhy, setVetWhy] = useState(initialWhy)
  const [vetClinic, setVetClinic] = useState(initialClinic)
  const [vetPhone, setVetPhone] = useState(editReminder?.clinic_phone || '')
  const [medName, setMedName] = useState(editKind === 'medicine' ? editTitle : '')
  const [medHowMuch, setMedHowMuch] = useState(editKind === 'medicine' ? editDescription : '')
  const [medLastDay, setMedLastDay] = useState(editReminder?.last_day || '')
  const [vaccineName, setVaccineName] = useState(editKind === 'vaccine' ? editTitle : '')
  const [otherName, setOtherName] = useState(editKind === 'other' ? editTitle : '')

  // Repeat and Notify me. A reminder that is already part of a repeating series
  // cannot have its repeat changed here (edits only change this one reminder).
  const isSeriesMember = Boolean(editReminder?.series_id)
  // "More options" holds Repeat and Last day. It starts closed, unless this reminder already uses them.
  const [moreOpen, setMoreOpen] = useState(
    Boolean(
      editReminder &&
        (editReminder.series_id ||
          (editReminder.repeat_kind && editReminder.repeat_kind !== 'never') ||
          editReminder.last_day)
    )
  )
  const [repeat, setRepeat] = useState(editReminder?.repeat_kind || 'never')
  const [customEvery, setCustomEvery] = useState(editReminder?.repeat_every ? String(editReminder.repeat_every) : '2')
  const [customUnit, setCustomUnit] = useState(editReminder?.repeat_unit || 'weeks')
  const [notify, setNotify] = useState(editReminder ? editReminder.notify_offsets || [] : ['on_day'])

  useEffect(() => {
    listAnimals()
      .then((res) => {
        if (res.error) {
          setError(`Could not load your animals: ${errorText(res.error)}`)
        } else if (res.animals) {
          setAnimals(res.animals)
          if (!preselectedAnimalId && res.animals.length > 0) {
            setForm((prev) => ({ ...prev, animal_id: res.animals[0].id }))
          }
        } else {
          setError('Could not load your animals: the server returned no list.')
        }
      })
      .catch((e) => setError(`Could not load your animals: ${errorText(e)}`))
      .finally(() => setLoading(false))
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleNotify(value) {
    setNotify((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  const kind = kindOf(form.reminder_type)

  async function handleSave() {
    if (!form.animal_id) {
      setError('Please choose an animal.')
      return
    }

    // Work out the title and the short detail line from the boxes for this kind.
    let title = ''
    let description = null

    if (kind === 'vet') {
      if (!vetWhy && !editReminder) {
        setError('Please pick why this vet visit is needed.')
        return
      }
      // Keep an existing custom title when editing a vet reminder.
      title =
        editReminder && editReminder.reminder_type === 'vet_visit' && editReminder.title
          ? editReminder.title
          : 'Vet visit'
      const composed = [vetWhy, vetClinic.trim()].filter(Boolean).join(' · ')
      description = composed || (editKind === 'vet' ? editReminder.description ?? null : null)
    } else if (kind === 'medicine') {
      if (!medName.trim()) {
        setError('Please type the medicine name, as the vet wrote it.')
        return
      }
      if (!medHowMuch.trim()) {
        setError('Please type how much, for example "1 tablet".')
        return
      }
      title = medName.trim()
      description = medHowMuch.trim()
    } else if (kind === 'vaccine') {
      if (!vaccineName.trim()) {
        setError('Please type what it is, for example "Rabies" or "Flea treatment".')
        return
      }
      title = vaccineName.trim()
      description = editKind === 'vaccine' ? editReminder.description ?? null : null
    } else {
      if (!otherName.trim()) {
        setError('Please type what we should call it, for example "Nail trim".')
        return
      }
      title = otherName.trim()
      description = editKind === 'other' ? editReminder.description ?? null : null
    }

    if (!date) {
      setError(kind === 'medicine' ? 'Please pick the start day.' : kind === 'vaccine' ? 'Please pick the next due day.' : 'Please pick a date.')
      return
    }
    if (kind === 'medicine' && medLastDay && medLastDay < date) {
      setMoreOpen(true)
      setError("The last day can't be before the start day.")
      return
    }
    if (addTime && !time) {
      setError('Please pick a time, or turn off "Add time".')
      return
    }
    if (repeat === 'custom' && !(Number(customEvery) >= 1)) {
      setMoreOpen(true)
      setError('For a custom repeat, "Every" must be 1 or more.')
      return
    }

    const due = new Date(`${date}T${addTime ? time : DEFAULT_TIME}`)
    if (Number.isNaN(due.getTime())) {
      setError('That date or time could not be read. Please pick it again.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      animal_id: form.animal_id,
      title,
      description,
      reminder_type: form.reminder_type,
      due_at: due.toISOString(),
      notes: form.notes.trim() || null,
      notify_offsets: notify,
      clinic_phone: kind === 'vet' ? vetPhone.trim() || null : null,
      last_day: kind === 'medicine' ? medLastDay || null : null,
    }

    // Repeat is only sent when this reminder is not already part of a series.
    if (!isSeriesMember) {
      payload.repeat_kind = repeat
      if (repeat === 'custom') {
        payload.repeat_every = Number(customEvery)
        payload.repeat_unit = customUnit
      }
    }

    let res
    try {
      res = editReminder
        ? await updateReminder({ reminder_id: editReminder.id, ...payload })
        : await createReminder(payload)
    } catch (e) {
      setSaving(false)
      setError(`Could not save the reminder: ${errorText(e)}`)
      return
    }

    setSaving(false)

    if (res.error) {
      setError(`Could not save the reminder: ${errorText(res.error)}`)
      return
    }

    if (editReminder) {
      navigate(`/reminders/${editReminder.id}`, { state: { from_animal_id: fromAnimalId } })
    } else if (fromAnimalId) {
      navigate(`/animals/${form.animal_id}`, { state: { tab: 'reminders' } })
    } else {
      navigate('/reminders')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  const typeChips =
    form.reminder_type && !TYPE_CHIPS.some((t) => t.value === form.reminder_type)
      ? [...TYPE_CHIPS, { value: form.reminder_type, label: OLD_TYPE_LABEL[form.reminder_type] || 'Other' }]
      : TYPE_CHIPS

  const selectedAnimal = animals.find((a) => a.id === form.animal_id)

  const seriesRepeatLabel =
    editReminder?.repeat_kind === 'custom'
      ? `Every ${editReminder.repeat_every} ${editReminder.repeat_unit}`
      : REPEAT_CHIPS.find((r) => r.value === editReminder?.repeat_kind)?.label || ''

  // A short reminder of what is set inside "More options", so nothing there is hidden.
  const repeatSummary = isSeriesMember
    ? seriesRepeatLabel
    : repeat === 'never'
      ? ''
      : repeat === 'custom'
        ? `Every ${customEvery} ${customUnit}`
        : REPEAT_CHIPS.find((r) => r.value === repeat)?.label || ''
  const moreSummary = [
    repeatSummary ? `Repeat: ${repeatSummary}` : '',
    kind === 'medicine' && medLastDay ? 'Last day set' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <style>{DATE_INPUT_CSS}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl">{editReminder ? 'Edit reminder' : 'Add reminder'}</h1>
      </div>

      <div className="px-6 space-y-6">
        {/* Which animal: a fixed line when we already know it, a dropdown otherwise */}
        {preselectedAnimalId ? (
          selectedAnimal && (
            <p className="text-[var(--text-muted)]">
              For <span className="text-[var(--accent)] font-medium">{selectedAnimal.name}</span>
            </p>
          )
        ) : (
          <div>
            <Label>Animal</Label>
            <div className="relative">
              <select
                value={form.animal_id}
                onChange={(e) => update('animal_id', e.target.value)}
                className="w-full appearance-none bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] outline-none"
              >
                {animals.length === 0 && <option value="">No animals yet</option>}
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.attributes?.breed ? `• ${a.attributes.breed}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* 1. What is this reminder for? */}
        <div>
          <Label>What is this reminder for?</Label>
          <div className="flex flex-wrap gap-2">
            {typeChips.map((t) => (
              <Chip
                key={t.value}
                selected={form.reminder_type === t.value}
                onClick={() => update('reminder_type', t.value)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* 2. Extra boxes, only for the kind picked */}
        {kind === 'vet' && (
          <>
            <div>
              <Label>Why?</Label>
              <div className="flex flex-wrap gap-2">
                {WHY_CHIPS.map((w) => (
                  <Chip key={w} selected={vetWhy === w} onClick={() => setVetWhy(w)}>
                    {w}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Clinic name (optional)</Label>
              <input
                type="text"
                value={vetClinic}
                onChange={(e) => setVetClinic(e.target.value)}
                placeholder="e.g. Greenfield Clinic"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <Label>Clinic phone (optional)</Label>
              <input
                type="tel"
                inputMode="tel"
                value={vetPhone}
                onChange={(e) => setVetPhone(e.target.value)}
                placeholder="Phone number"
                className={INPUT_CLASS}
              />
            </div>
          </>
        )}

        {kind === 'medicine' && (
          <>
            <div>
              <Label>Medicine name</Label>
              <input
                type="text"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Apoquel"
                className={INPUT_CLASS}
              />
              <Hint>Copy what the vet wrote. Do not guess a name.</Hint>
            </div>
            <div>
              <Label>How much?</Label>
              <input
                type="text"
                value={medHowMuch}
                onChange={(e) => setMedHowMuch(e.target.value)}
                placeholder="e.g. 1 tablet"
                className={INPUT_CLASS}
              />
              <Hint>Type it as words. Example: 1 tablet</Hint>
            </div>
          </>
        )}

        {kind === 'vaccine' && (
          <div>
            <Label>What is it?</Label>
            <input
              type="text"
              value={vaccineName}
              onChange={(e) => setVaccineName(e.target.value)}
              placeholder="e.g. Rabies or Flea treatment"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {kind === 'other' && (
          <div>
            <Label>What should we call it?</Label>
            <input
              type="text"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="e.g. Nail trim"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {/* 3. Date & time (named differently for each kind) */}
        <div>
          <Label>{DATE_LABEL[kind]}</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLASS}
            style={DATE_INPUT_STYLE}
          />
          {kind === 'medicine' && <Hint>Usually today</Hint>}

          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-[var(--text)]">Add time</span>
            <button
              type="button"
              role="switch"
              aria-checked={addTime}
              onClick={() => setAddTime((v) => !v)}
              className={`w-12 h-7 rounded-full border flex items-center px-0.5 transition-colors ${
                addTime ? 'bg-[var(--accent)] border-[var(--accent)] justify-end' : 'bg-[var(--surface-secondary)] border-[var(--border)] justify-start'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-[var(--text)]" />
            </button>
          </div>

          {addTime ? (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={`${INPUT_CLASS} mt-3`}
              style={DATE_INPUT_STYLE}
            />
          ) : (
            <Hint>No time set. It will be saved as 9:00 AM that day.</Hint>
          )}
        </div>

        {/* 5. Notify me (pick as many as you like) */}
        <div>
          <Label>Notify me</Label>
          <div className="flex flex-wrap gap-2">
            {NOTIFY_CHIPS.map((n) => (
              <Chip key={n.value} selected={notify.includes(n.value)} onClick={() => toggleNotify(n.value)}>
                {n.label}
              </Chip>
            ))}
          </div>
          <Hint>You get these on devices where notifications are turned on (Profile, then Notifications).</Hint>
        </div>

        {/* 6. Notes */}
        <div>
          <Label>Notes (optional)</Label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any extra details..."
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        {/* 7. More options (Repeat and Last day) */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="w-full flex items-center justify-between gap-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-left"
          >
            <span className="text-sm text-[var(--text)]">More options</span>
            <span className="flex items-center gap-2 text-sm text-[var(--text-muted)] min-w-0">
              {moreSummary && <span className="truncate">{moreSummary}</span>}
              <ChevronDown
                size={18}
                className={`flex-shrink-0 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              />
            </span>
          </button>

          {moreOpen && (
            <div className="mt-6 space-y-6">
        {/* 4. Repeat */}
        <div>
          <Label>Repeat</Label>
          {isSeriesMember ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <p className="text-sm text-[var(--surface-text)]">Repeats: {seriesRepeatLabel}</p>
              <Hint>
                This reminder is part of a repeating series. Changes here only affect this one reminder.
              </Hint>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {REPEAT_CHIPS.map((r) => (
                  <Chip key={r.value} selected={repeat === r.value} onClick={() => setRepeat(r.value)}>
                    {r.label}
                  </Chip>
                ))}
              </div>

              {repeat === 'custom' && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-[var(--text)]">Every</span>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={customEvery}
                    onChange={(e) => setCustomEvery(e.target.value)}
                    className="w-20 bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-3 py-2.5 text-[var(--text)] outline-none text-center"
                  />
                  <div className="flex flex-wrap gap-2">
                    {CUSTOM_UNITS.map((u) => (
                      <Chip key={u.value} selected={customUnit === u.value} onClick={() => setCustomUnit(u.value)}>
                        {u.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {repeat !== 'never' && (
                <Hint>The next few reminders are created ahead of time, and more are added as time passes.</Hint>
              )}
            </>
          )}
        </div>

        {kind === 'medicine' && (
          <div>
            <Label>Last day (optional)</Label>
            <input
              type="date"
              value={medLastDay}
              min={date || undefined}
              onChange={(e) => setMedLastDay(e.target.value)}
              className={INPUT_CLASS}
              style={DATE_INPUT_STYLE}
            />
            <Hint>If it is a short course</Hint>
          </div>
        )}

            </div>
          )}
        </div>

        {error && <p className="text-sm text-[var(--error)] break-words">{error}</p>}

        {/* Primary button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3.5 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : editReminder ? 'Save changes' : 'Save reminder'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}