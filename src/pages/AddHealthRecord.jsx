import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X, Weight, Eye, Pill, ShieldCheck, Stethoscope, FileText } from 'lucide-react'
import { createHealthRecord } from '../lib/healthRecordsApi'
import { getAnimal } from '../lib/animalsApi'
import Disclaimer from '../components/Disclaimer'

// "What happened?" tiles. Weight and Noticed have their own boxes.
// The others keep the simple title form they always had.
const TYPES = [
  { value: 'weight', label: 'Weight', Icon: Weight },
  { value: 'symptom', label: 'Noticed', Icon: Eye },
  { value: 'medication', label: 'Medicine', Icon: Pill },
  { value: 'vaccination', label: 'Vaccine', Icon: ShieldCheck },
  { value: 'vet_visit', label: 'Vet visit', Icon: Stethoscope },
  { value: 'note', label: 'Note', Icon: FileText },
]

// Title box wording for the types that use the simple form.
const TITLE_INFO = {
  medication: { label: 'Medicine name', placeholder: 'e.g. Apoquel' },
  vaccination: { label: 'What is it?', placeholder: 'e.g. Rabies' },
  vet_visit: { label: 'What was it for?', placeholder: 'e.g. Checkup' },
  note: { label: 'Title', placeholder: 'e.g. Ate less today' },
}

const SEVERITY_LEVELS = [1, 2, 3, 4, 5]

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
  input[type="datetime-local"]::-webkit-date-and-time-value {
    text-align: left;
    min-width: 0;
  }
`

function pad(n) {
  return String(n).padStart(2, '0')
}

// "YYYY-MM-DDTHH:mm" for right now, in the phone's local time.
function nowLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function Label({ children }) {
  return <label className="block text-sm text-[var(--text-muted)] mb-2">{children}</label>
}

function Hint({ children }) {
  return <p className="text-xs text-[var(--text-muted)] mt-2">{children}</p>
}

// A button that is either selected (accent) or not.
function Choice({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl text-sm border py-3 ${
        selected
          ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)] font-medium'
          : 'bg-[var(--input-bg)] text-[var(--text)] border-[var(--border)]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export default function AddHealthRecord() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [animalName, setAnimalName] = useState('')
  const [animalError, setAnimalError] = useState('')

  const [recordType, setRecordType] = useState('weight')
  const [when, setWhen] = useState(nowLocal())
  const [extraText, setExtraText] = useState('')

  // Weight
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')

  // Noticed
  const [seen, setSeen] = useState('')
  const [severity, setSeverity] = useState(null)
  const [stillHappening, setStillHappening] = useState(null)

  // Medicine, Vaccine, Vet visit, Note
  const [title, setTitle] = useState('')

  // Vaccine and Vet visit: an optional next due date. It is only used to offer a reminder afterwards.
  const [nextDue, setNextDue] = useState('')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    getAnimal(id)
      .then((res) => {
        if (res.error) {
          setAnimalError(`Could not load the animal's name: ${errorText(res.error)}`)
        } else if (res.animal) {
          setAnimalName(res.animal.name || '')
        } else {
          setAnimalError("Could not load the animal's name: the server returned no animal.")
        }
      })
      .catch((e) => setAnimalError(`Could not load the animal's name: ${errorText(e)}`))
  }, [id])

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setErrorMsg('')

    const whenDate = new Date(when)
    if (!when || Number.isNaN(whenDate.getTime())) {
      setErrorMsg('Please pick when this happened.')
      return
    }

    const fields = {
      record_type: recordType,
      description: extraText.trim() || null,
      // The calendar day, exactly as picked on the phone (no time zone shift).
      record_date: when.slice(0, 10),
      happened_at: whenDate.toISOString(),
    }

    if (recordType === 'weight') {
      const num = Number(weightValue.trim().replace(',', '.'))
      if (!weightValue.trim() || !Number.isFinite(num) || num <= 0) {
        setErrorMsg('Please type the weight as a number, for example 12.4')
        return
      }
      fields.title = `${num} ${weightUnit}`
      fields.weight_value = num
      fields.weight_unit = weightUnit
    } else if (recordType === 'symptom') {
      if (!seen.trim()) {
        setErrorMsg('Please say what you saw.')
        return
      }
      if (severity === null) {
        setErrorMsg('Please pick how bad it is, from 1 to 5.')
        return
      }
      if (stillHappening === null) {
        setErrorMsg('Please say if it is still happening.')
        return
      }
      fields.title = seen.trim()
      fields.severity = severity
      fields.still_happening = stillHappening
    } else {
      if (!title.trim()) {
        setErrorMsg('Please fill in the title.')
        return
      }
      fields.title = title.trim()
    }

    const asksForReminder = (recordType === 'vaccination' || recordType === 'vet_visit') && nextDue
    if (asksForReminder && nextDue < when.slice(0, 10)) {
      setErrorMsg("The next due date can't be before the date of this note.")
      return
    }

    setSaving(true)
    let res
    try {
      res = await createHealthRecord(id, fields)
    } catch (err) {
      setSaving(false)
      setErrorMsg(`Could not save the note: ${errorText(err)}`)
      return
    }
    setSaving(false)

    if (res.error) {
      setErrorMsg(`Could not save the note: ${errorText(res.error)}`)
      return
    }

    // If a next date was given, the notes tab offers to turn it into a reminder.
    // (It is only a suggestion: the person can ignore it and it goes away.)
    if (asksForReminder) {
      const suggest =
        recordType === 'vaccination'
          ? { title: fields.title, reminder_type: 'vaccination', description: null, due_date: nextDue }
          : { title: 'Vet visit', reminder_type: 'vet_visit', description: fields.title, due_date: nextDue }
      navigate(`/animals/${id}`, { state: { tab: 'notes', suggest } })
      return
    }

    navigate(`/animals/${id}`, { state: { tab: 'notes' } })
  }

  const titleInfo = TITLE_INFO[recordType]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <style>{DATE_INPUT_CSS}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
        >
          <X size={18} />
        </button>
        <h1 className="font-display text-xl">Add note</h1>
        <button
          type="submit"
          form="add-note-form"
          disabled={saving}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--bg)] text-sm font-medium disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {animalName && (
        <p className="text-center text-[var(--text-muted)] pb-4">
          For <span className="text-[var(--accent)] font-medium">{animalName}</span>
        </p>
      )}
      {animalError && (
        <p className="px-6 pb-4 text-sm text-[var(--error)] break-words text-center">{animalError}</p>
      )}

      <form id="add-note-form" onSubmit={handleSubmit} className="px-6 space-y-6">
        {/* What happened? */}
        <div>
          <Label>What happened?</Label>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map((t) => {
              const selected = recordType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setRecordType(t.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border py-4 text-sm ${
                    selected
                      ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)] font-medium'
                      : 'bg-[var(--input-bg)] text-[var(--text)] border-[var(--border)]'
                  }`}
                >
                  <t.Icon size={24} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Weight */}
        {recordType === 'weight' && (
          <>
            <div>
              <Label>Number</Label>
              <input
                type="text"
                inputMode="decimal"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="e.g. 12.4"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={weightUnit === 'kg'} onClick={() => setWeightUnit('kg')}>
                  kg
                </Choice>
                <Choice selected={weightUnit === 'lb'} onClick={() => setWeightUnit('lb')}>
                  lb
                </Choice>
              </div>
            </div>
          </>
        )}

        {/* Noticed */}
        {recordType === 'symptom' && (
          <>
            <div>
              <Label>What did you see?</Label>
              <input
                type="text"
                value={seen}
                onChange={(e) => setSeen(e.target.value)}
                placeholder="e.g. Limping after walk"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <Label>How bad is it?</Label>
              <div className="grid grid-cols-5 gap-2">
                {SEVERITY_LEVELS.map((n) => (
                  <Choice key={n} selected={severity === n} onClick={() => setSeverity(n)}>
                    {n}
                  </Choice>
                ))}
              </div>
              <Hint>1 is mild, 5 is very bad.</Hint>
              {severity !== null && severity >= 4 && (
                <div className="mt-3 bg-[var(--surface)] border border-[var(--error)] rounded-2xl p-4">
                  <p className="text-sm text-[var(--error)] font-medium">
                    If this is an emergency, call a vet now. This app cannot diagnose.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>Is it still happening?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={stillHappening === true} onClick={() => setStillHappening(true)}>
                  Yes
                </Choice>
                <Choice selected={stillHappening === false} onClick={() => setStillHappening(false)}>
                  No
                </Choice>
              </div>
            </div>
          </>
        )}

        {recordType === 'symptom' && <Disclaimer />}

        {/* Medicine, Vaccine, Vet visit, Note */}
        {titleInfo && (
          <div>
            <Label>{titleInfo.label}</Label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titleInfo.placeholder}
              className={INPUT_CLASS}
            />
          </div>
        )}

        {/* Next due date (Vaccine and Vet visit only) */}
        {(recordType === 'vaccination' || recordType === 'vet_visit') && (
          <div>
            <Label>Next due date (optional)</Label>
            <input
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className={INPUT_CLASS}
              style={DATE_INPUT_STYLE}
            />
            <Hint>If you add one, we will ask if you want a reminder for it.</Hint>
          </div>
        )}

        {/* When */}
        <div>
          <Label>When</Label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={INPUT_CLASS}
            style={DATE_INPUT_STYLE}
          />
          <Hint>Starts at today, right now. Change it if this happened earlier.</Hint>
        </div>

        {/* Anything else */}
        <div>
          <Label>Anything else? (optional)</Label>
          <textarea
            value={extraText}
            onChange={(e) => setExtraText(e.target.value)}
            placeholder="Anything else?"
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        {errorMsg && <p className="text-sm text-[var(--error)] break-words">{errorMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3.5 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save note'}
        </button>
      </form>
    </div>
  )
}
