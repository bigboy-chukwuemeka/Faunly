import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, PawPrint, MessageCircle, Pencil, Trash2, HeartPulse, Plus, Stethoscope, Syringe, Pill, FileText, X, Bell, ChevronRight, Clock, ShieldCheck, Eye, CalendarDays, Settings, Weight } from 'lucide-react'
import { getAnimal, deleteAnimal } from '../lib/animalsApi'
import { listHealthRecords, deleteHealthRecord } from '../lib/healthRecordsApi'
import { listReminders, createReminder } from '../lib/remindersApi'
import { listAnimalConversations } from '../lib/historyApi'
import BottomNav from '../components/BottomNav'
import FollowUpCard from '../components/FollowUpCard'
import Disclaimer from '../components/Disclaimer'
import { collapseSeries, repeatPhrase } from '../lib/reminderSeries'

const STATUS_STYLE = {
  healthy: { label: 'Healthy', className: 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' },
  needs_attention: { label: 'Needs attention', className: 'bg-[var(--accent)]/20 text-[var(--accent)]' },
  not_tracked: { label: 'Not tracked', className: 'bg-[var(--surface)] text-[var(--surface-text-muted)]' },
}

const RECORD_ICON = {
  weight: Weight,
  symptom: Eye,
  vet_visit: Stethoscope,
  vaccination: Syringe,
  medication: Pill,
  note: FileText,
}

const RECORD_LABEL = {
  weight: 'Weight',
  symptom: 'Noticed',
  vet_visit: 'Vet visit',
  vaccination: 'Vaccine',
  medication: 'Medicine',
  note: 'Note',
}

function RecordIcon({ type, size = 16 }) {
  const Icon = RECORD_ICON[type] || FileText
  return <Icon size={size} />
}

const REMINDER_ICON = {
  vaccination: Syringe,
  medication: Pill,
  vet_visit: Stethoscope,
  follow_up: Bell,
  weight_check: PawPrint,
  custom: Bell,
}

const REMINDER_TYPE_LABEL = {
  vaccination: 'Vaccination',
  medication: 'Medication',
  vet_visit: 'Vet check-up',
  follow_up: 'Follow-up',
  weight_check: 'Weight check',
  custom: 'Reminder',
}

// Reminders due within this many days (or already overdue) go under UPCOMING.
// Anything further away goes under LATER.
const UPCOMING_DAYS = 30

// The four tabs, in display order.
const TABS = [
  { key: 'record', label: 'Record' },
  { key: 'notes', label: 'Notes' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'chat', label: 'Chat' },
]

// Other pages (My Animals, Add Record) still send the OLD tab names when they
// open a profile. These aliases send them to the matching new tab so those
// pages keep working without being edited.
const TAB_ALIASES = {
  overview: 'record',
  health: 'notes',
  history: 'chat',
}

function resolveTab(name) {
  if (!name) return 'record'
  if (TABS.some((t) => t.key === name)) return name
  return TAB_ALIASES[name] || 'record'
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

function ErrorBox({ title, message }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-sm font-medium text-[var(--error)]">{title}</p>
      <p className="text-sm text-[var(--error)] mt-1 break-words">{message}</p>
    </div>
  )
}

function reminderDaysUntil(dateStr) {
  const due = new Date(dateStr)
  const now = new Date()
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

function reminderDateLabel(dateStr) {
  const days = reminderDaysUntil(dateStr)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// Shows the age the way the mockup does: "about 4 years".
// - just a number ("4")            -> "about 4 years"
// - starts with a number ("6 months") -> "about 6 months"
// - anything else ("Adult", "about 3 years") -> shown as it is saved
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

// "Fri, 3 Oct" for the Next row. Falls back to "In 3 days" style text if the
// date can't be read.
function reminderDueText(dateStr) {
  const due = new Date(dateStr)
  if (Number.isNaN(due.getTime())) return reminderDateLabel(dateStr)
  return due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// Which animal a reminder belongs to. Returns undefined if the data doesn't say.
function reminderAnimalId(r) {
  return r.animal_id ?? r.animals?.id
}

// Day/time text for a reminder card, like the mockup:
// "Today 9:00", "Tomorrow 8:00", "Fri 10:00", "5 Oct", or (for LATER) "Mar 2027".
function reminderWhen(dateStr, isLater) {
  const due = new Date(dateStr)
  if (Number.isNaN(due.getTime())) return { text: 'No date', tone: 'muted' }

  if (isLater) {
    return {
      text: due.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      tone: 'muted',
    }
  }

  const time = `${due.getHours()}:${String(due.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diff = Math.round((dueDay - today) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { text: 'Overdue', tone: 'error' }
  if (diff === 0) return { text: `Today ${time}`, tone: 'accent' }
  if (diff === 1) return { text: `Tomorrow ${time}`, tone: 'accent' }
  if (diff <= 6) {
    return { text: `${due.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`, tone: 'muted' }
  }
  return { text: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), tone: 'muted' }
}

const WHEN_TONE_CLASS = {
  error: 'text-[var(--error)]',
  accent: 'text-[var(--accent)]',
  muted: 'text-[var(--surface-text-muted)]',
}

// Reads a "YYYY-MM-DD" (or full ISO) string as a LOCAL calendar date so the
// day does not shift because of time zones. Returns null if it can't be read.
function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

// "Today", "Yesterday", or "3 Sep"
function recordDateLabel(dateStr) {
  const date = parseLocalDate(dateStr)
  if (!date) return dateStr ? String(dateStr) : 'No date'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - date) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (date.getFullYear() !== today.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// "Mar 2026"
function monthYearLabel(dateStr) {
  const date = parseLocalDate(dateStr)
  if (!date) return dateStr ? String(dateStr) : 'No date'
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

// When a note happened, as a number: the exact time if it was saved,
// otherwise the start of that day.
function recordTime(r) {
  if (r.happened_at) {
    const t = new Date(r.happened_at).getTime()
    if (!Number.isNaN(t)) return t
  }
  const d = parseLocalDate(r.record_date)
  return d ? d.getTime() : 0
}

// "Today 7:14", "Yesterday", "3 Sep"
function recordWhenLabel(r) {
  const day = recordDateLabel(r.record_date)
  if (day === 'Today' && r.happened_at) {
    const t = new Date(r.happened_at)
    if (!Number.isNaN(t.getTime())) return `Today ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`
  }
  return day
}

// "12.4 kg" for a weight note (falls back to the title for older notes)
function weightText(r) {
  if (r.weight_value !== null && r.weight_value !== undefined && r.weight_unit) {
    return `${Number(r.weight_value)} ${r.weight_unit}`
  }
  return r.title
}

// The one-line detail on a note card, like "Limping after walk · still happening · 3/5"
function recordDetail(r) {
  if (r.record_type === 'weight') return r.description || ''
  const parts = [r.title]
  if (r.record_type === 'symptom') {
    if (r.still_happening === true) parts.push('still happening')
    if (r.still_happening === false) parts.push('no longer happening')
    if (r.severity) parts.push(`${r.severity}/5`)
  }
  if (r.description) parts.push(r.description)
  return parts.filter(Boolean).join(' · ')
}

// One summary card on the Record tab. If onOpen is given, the header row is
// tappable and shows a chevron.
function SummaryCard({ icon, title, onOpen, children }) {
  const header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <h3 className="font-semibold text-base text-[var(--surface-text)]">{title}</h3>
      </div>
      {onOpen && <ChevronRight size={16} className="text-[var(--surface-text-muted)]" />}
    </div>
  )

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      {onOpen ? (
        <button onClick={onOpen} className="w-full text-left mb-2">
          {header}
        </button>
      ) : (
        <div className="mb-2">{header}</div>
      )}
      {children}
    </div>
  )
}

export default function AnimalProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [animal, setAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState(resolveTab(location.state?.tab))
  // A reminder suggestion handed over by the Add note screen (shown once, on the Notes tab).
  const [suggestion, setSuggestion] = useState(location.state?.suggest || null)

  // Switches tab AND remembers it in the browser history, so pressing Back
  // from a reminder or record page returns to the same tab.
  function changeTab(key) {
    setTab(key)
    navigate(location.pathname, { replace: true, state: { ...(location.state || {}), tab: key } })
  }
  const [healthRecords, setHealthRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [recordsError, setRecordsError] = useState(null)
  const [reminders, setReminders] = useState([])
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [remindersError, setRemindersError] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversationsError, setConversationsError] = useState(null)
  const [openingChat, setOpeningChat] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Remove the suggestion from the browser history right away, so going Back later
  // does not show it again.
  useEffect(() => {
    if (location.state?.suggest) {
      navigate(location.pathname, { replace: true, state: { tab: location.state.tab } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    getAnimal(id)
      .then((res) => {
        if (res.error) {
          setLoadError(errorText(res.error))
        } else if (res.animal) {
          setAnimal(res.animal)
        } else {
          setLoadError('The server did not return an animal for this ID.')
        }
      })
      .catch((e) => setLoadError(errorText(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    // Record and Notes both need the health records.
    if (tab === 'record' || tab === 'notes') {
      setLoadingRecords(true)
      setRecordsError(null)
      listHealthRecords(id)
        .then((res) => {
          if (res.error) {
            setRecordsError(errorText(res.error))
          } else if (res.records) {
            setHealthRecords(res.records)
          } else {
            setRecordsError('Unexpected response while loading notes: no "records" field came back.')
          }
        })
        .catch((e) => setRecordsError(errorText(e)))
        .finally(() => setLoadingRecords(false))
    }

    // Record (for the "Next" reminder) and Reminders both need the reminders.
    if (tab === 'record' || tab === 'reminders') {
      setLoadingReminders(true)
      setRemindersError(null)
      listReminders({ animal_id: id, status: 'pending' })
        .then((res) => {
          if (res.error) {
            setRemindersError(errorText(res.error))
          } else if (res.reminders) {
            if (res.reminders.some((r) => reminderAnimalId(r) === undefined)) {
              setRemindersError(
                "The reminders that came back don't say which animal they belong to, so I can't safely show them here."
              )
            } else {
              setReminders(res.reminders.filter((r) => reminderAnimalId(r) === id))
            }
          } else {
            setRemindersError('Unexpected response while loading reminders: no "reminders" field came back.')
          }
        })
        .catch((e) => setRemindersError(errorText(e)))
        .finally(() => setLoadingReminders(false))
    }

    if (tab === 'chat') {
      setLoadingConversations(true)
      setConversationsError(null)
      listAnimalConversations(id)
        .then((res) => {
          if (res.error) {
            setConversationsError(errorText(res.error))
          } else if (res.conversations) {
            setConversations(res.conversations)
          } else {
            setConversationsError('Unexpected response while loading chats: no "conversations" field came back.')
          }
        })
        .catch((e) => setConversationsError(errorText(e)))
        .finally(() => setLoadingConversations(false))
    }
  }, [tab, id])

  async function handleDelete() {
    if (!window.confirm(`Delete ${animal.name}'s profile? This also deletes its notes and reminders, and cannot be undone.`)) return
    setActionError(null)
    try {
      const res = await deleteAnimal(id)
      if (res.error) {
        setActionError(`Could not delete this animal: ${errorText(res.error)}`)
        return
      }
      navigate('/my-animals')
    } catch (e) {
      setActionError(`Could not delete this animal: ${errorText(e)}`)
    }
  }

  async function handleDeleteRecord(recordId) {
    if (!window.confirm('Delete this health record?')) return
    setActionError(null)
    try {
      const res = await deleteHealthRecord(id, recordId)
      if (res.error) {
        setActionError(`Could not delete this record: ${errorText(res.error)}`)
        return
      }
      setHealthRecords((prev) => prev.filter((r) => r.id !== recordId))
    } catch (e) {
      setActionError(`Could not delete this record: ${errorText(e)}`)
    }
  }

  async function openChat() {
    if (openingChat) return
    setOpeningChat(true)
    setActionError(null)

    // Resume the animal's existing general conversation if one exists,
    // rather than always starting a fresh one — this is what makes
    // reopening this profile show prior chat history.
    let res
    try {
      res = await listAnimalConversations(id)
    } catch (e) {
      setOpeningChat(false)
      setActionError(`Could not open the chat: ${errorText(e)}`)
      return
    }

    setOpeningChat(false)

    if (res.error) {
      setActionError(`Could not open the chat: ${errorText(res.error)}`)
      return
    }

    const existingGeneral = (res.conversations || []).find((c) => c.kind === 'general')

    if (existingGeneral) {
      navigate(`/history/${existingGeneral.id}`)
      return
    }

    navigate('/chat', {
      state: {
        animal: {
          id: animal.id,
          common_name: animal.name,
          scientific_name: null,
          facts: { habitat: null, diet: null, behavior: null, conservation_status: null },
        },
        image: animal.photo_url || null,
      },
    })
  }

  // Turns the suggestion into a real reminder (9:00 AM on the chosen day). Throws if it fails.
  async function createSuggestedReminder() {
    const due = new Date(`${suggestion.due_date}T09:00`)
    if (Number.isNaN(due.getTime())) throw new Error('That date could not be read.')
    const res = await createReminder({
      animal_id: id,
      title: suggestion.title,
      description: suggestion.description,
      reminder_type: suggestion.reminder_type,
      due_at: due.toISOString(),
      notify_offsets: ['on_day'],
    })
    if (res.error) throw new Error(errorText(res.error))
  }

  function openHealthAssistant() {
    navigate(`/animals/${animal.id}/health-assistant`)
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">Loading...</div>
  }

  if (!animal) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-2">Animal not found.</p>
        {loadError && <p className="mb-4 text-sm text-[var(--error)] break-words">{loadError}</p>}
        <button onClick={() => navigate('/my-animals')} className="text-[var(--accent)] underline">Back to My Animals</button>
      </div>
    )
  }

  // ----- Record tab summary data (read-only, built from what is already loaded) -----
  const recordsNewestFirst = [...healthRecords].sort((a, b) => {
    const byTime = recordTime(b) - recordTime(a)
    if (byTime !== 0) return byTime
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
  const latestWeight =
    recordsNewestFirst.find((r) => r.record_type === 'weight' && r.weight_value !== null && r.weight_value !== undefined) ||
    null
  const vaccineRows = recordsNewestFirst.filter((r) => r.record_type === 'vaccination').slice(0, 3)
  const medicineRows = recordsNewestFirst.filter((r) => r.record_type === 'medication').slice(0, 3)
  const recentNoteRows = recordsNewestFirst.slice(0, 3)
  const notesThisWeek = healthRecords.filter((r) => {
    const d = parseLocalDate(r.record_date)
    if (!d) return false
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    const diff = Math.round((t - d) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 6
  }).length
  // A repeating reminder shows as one card (its soonest one), not one card per day or week.
  const remindersSoonestFirst = collapseSeries(reminders).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
  const nextReminder = remindersSoonestFirst[0] || null
  const laterCutoff = Date.now() + UPCOMING_DAYS * 24 * 60 * 60 * 1000
  const isLaterReminder = (r) => {
    const t = new Date(r.due_at).getTime()
    return !Number.isNaN(t) && t > laterCutoff
  }
  const upcomingReminders = remindersSoonestFirst.filter((r) => !isLaterReminder(r))
  const laterReminders = remindersSoonestFirst.filter(isLaterReminder)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <button onClick={() => navigate('/my-animals')} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <p className="font-display text-lg">{tab === 'record' ? 'Health record' : tab === 'notes' ? 'Health notes' : animal.name}</p>
        {tab === 'record' ? (
          <button
            onClick={() => navigate('/add-animal', { state: { editAnimal: animal } })}
            aria-label="Edit animal"
            className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
          >
            <Settings size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <div className="px-6 mb-5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
          <div
            className="bg-[var(--surface-secondary)] border-2 border-[var(--border)] flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 112, height: 112, minWidth: 112, borderRadius: '50%' }}
          >
            {animal.photo_url ? (
              <img src={animal.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <PawPrint size={36} className="text-[var(--surface-text-muted)]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-4xl font-bold leading-tight text-[var(--surface-text)] truncate">{animal.name}</h2>
            <p className="text-sm text-[var(--surface-text-muted)] mt-1 break-words">
              {[animal.attributes?.breed || animal.species_label, formatAge(animal.estimated_age)]
                .filter(Boolean)
                .join(' · ')}
            </p>

            {tab === 'record' && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="flex items-center gap-3">
                  <Weight size={20} className="text-[var(--accent)] flex-shrink-0" />
                  {loadingRecords ? (
                    <span className="text-sm text-[var(--surface-text-muted)]">Loading...</span>
                  ) : recordsError ? (
                    <span className="text-sm text-[var(--surface-text-muted)]">Weight unavailable</span>
                  ) : latestWeight ? (
                    <span className="text-sm text-[var(--surface-text)]">
                      <span className="font-semibold">{weightText(latestWeight)}</span>
                      <span className="text-[var(--surface-text-muted)]"> • {recordDateLabel(latestWeight.record_date)}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--surface-text-muted)]">No weight recorded yet</span>
                  )}
                </div>

                {loadingReminders ? (
                  <p className="text-sm text-[var(--surface-text-muted)]">Loading...</p>
                ) : remindersError ? (
                  <p className="text-sm text-[var(--error)] break-words">Could not load reminders: {remindersError}</p>
                ) : nextReminder ? (
                  <button
                    onClick={() => navigate(`/reminders/${nextReminder.id}`, { state: { from_animal_id: id } })}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <CalendarDays size={20} className="text-[var(--accent)] flex-shrink-0" />
                    <span className="text-sm text-[var(--surface-text)] leading-snug break-words">
                      Next: <span className="font-bold">{nextReminder.title}</span> {reminderDueText(nextReminder.due_at)}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <CalendarDays size={20} className="text-[var(--surface-text-muted)] flex-shrink-0" />
                    <span className="text-sm text-[var(--surface-text-muted)]">No upcoming reminders</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-6 mb-5 flex bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={`flex-1 text-sm py-1.5 rounded-full ${
              tab === t.key ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6">
        {actionError && (
          <div className="mb-4">
            <ErrorBox title="Something failed" message={actionError} />
          </div>
        )}

        {tab === 'record' && (
          <div className="space-y-4">
            {/* Vaccines, medicines, recent notes (all come from the health records) */}
            {loadingRecords ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : recordsError ? (
              <ErrorBox title="Could not load health records" message={recordsError} />
            ) : (
              <>
                <SummaryCard
                  icon={<ShieldCheck size={18} />}
                  title="Vaccines & preventives"
                  onOpen={() => changeTab('notes')}
                >
                  {vaccineRows.length === 0 ? (
                    <p className="text-sm text-[var(--surface-text-muted)]">No vaccines recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {vaccineRows.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <span className="text-[var(--accent)] flex-shrink-0"><Syringe size={16} /></span>
                          <p className="text-[var(--surface-text)] truncate">
                            {r.title}
                            <span className="text-[var(--surface-text-muted)]"> · last {monthYearLabel(r.record_date)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </SummaryCard>

                <SummaryCard
                  icon={<Pill size={18} />}
                  title="Now on"
                  onOpen={() => changeTab('notes')}
                >
                  {medicineRows.length === 0 ? (
                    <p className="text-sm text-[var(--surface-text-muted)]">No medicines recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {medicineRows.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <span className="text-[var(--accent)] flex-shrink-0"><Pill size={16} /></span>
                          <p className="text-[var(--surface-text)] truncate">
                            {r.title}
                            <span className="text-[var(--surface-text-muted)]">
                              {' '}
                              · {r.description ? r.description : monthYearLabel(r.record_date)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </SummaryCard>

                <SummaryCard icon={<Eye size={18} />} title="Watching">
                  <p className="text-sm text-[var(--surface-text-muted)]">Nothing being watched yet.</p>
                </SummaryCard>

                <div>
                  <h3 className="font-semibold text-lg mb-1">Recent notes</h3>
                  {recentNoteRows.length === 0 ? (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                      <p className="text-sm text-[var(--surface-text-muted)]">
                        No notes yet for {animal.name}. Tap "Add note" to start.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* dashed line that joins the round icons */}
                      <div className="absolute left-[19px] top-7 bottom-7 border-l-2 border-dashed border-[var(--accent)]/50" />
                      {recentNoteRows.map((r, index) => (
                        <div key={r.id} className="relative flex items-center gap-3">
                          <div className="relative z-10 w-10 h-10 my-2 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center flex-shrink-0">
                            <RecordIcon type={r.record_type} size={20} />
                          </div>
                          <div
                            className={`flex-1 min-w-0 py-4 ${
                              index < recentNoteRows.length - 1 ? 'border-b border-[var(--border)]' : ''
                            }`}
                          >
                            <p className="text-base text-[var(--text)] truncate">
                              <span className="font-semibold">{RECORD_LABEL[r.record_type] || 'Note'}</span>
                              <span className="text-[var(--text-muted)]"> · </span>
                              <span className="text-[var(--accent)]">
                                {r.record_type === 'weight' ? weightText(r) : r.title}
                              </span>
                              <span className="text-[var(--text-muted)]"> · {recordWhenLabel(r)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quick actions */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/animals/${id}/add-record`)}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium text-sm"
              >
                <Plus size={16} /> Add note
              </button>
              <button
                onClick={() => navigate('/reminders/add', { state: { animal_id: id, from_animal_id: id } })}
                className="flex-1 flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] rounded-full py-3 font-medium text-sm"
              >
                <Bell size={16} /> Add reminder
              </button>
            </div>

            {animal.notes && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                <h3 className="font-medium mb-1">About</h3>
                <p className="text-sm text-[var(--surface-text-muted)]">{animal.notes}</p>
              </div>
            )}

            <div className="bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)]">
              <button
                onClick={() => navigate('/add-animal', { state: { editAnimal: animal } })}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <Pencil size={18} className="text-[var(--accent)]" />
                <span className="text-[var(--surface-text)]">Edit Animal</span>
              </button>
              <button onClick={handleDelete} className="w-full flex items-center gap-3 p-4 text-left">
                <Trash2 size={18} className="text-[var(--error)]" />
                <span className="text-[var(--error)]">Delete Animal</span>
              </button>
            </div>
            <Disclaimer />
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-4">
            {suggestion && (
              <FollowUpCard
                question="Set a reminder?"
                detail={`${suggestion.title}${suggestion.description ? ` · ${suggestion.description}` : ''} · ${
                  parseLocalDate(suggestion.due_date)?.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }) || suggestion.due_date
                }`}
                yesLabel="Yes, set it"
                onYes={createSuggestedReminder}
                successText="Reminder set. You can see it in the Reminders tab."
                onClose={() => setSuggestion(null)}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] rounded-full px-3.5 py-2 text-sm text-[var(--surface-text)]">
                <Weight size={16} className="text-[var(--accent)]" />{' '}
                {loadingRecords
                  ? 'Latest weight: ...'
                  : recordsError
                    ? 'Latest weight: unavailable'
                    : latestWeight
                      ? `Latest weight ${weightText(latestWeight)}`
                      : 'Latest weight: none yet'}
              </div>
              <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] rounded-full px-3.5 py-2 text-sm text-[var(--surface-text)]">
                <FileText size={16} className="text-[var(--accent)]" /> {notesThisWeek} {notesThisWeek === 1 ? 'note' : 'notes'} this week
              </div>
            </div>

            {loadingRecords ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : recordsError ? (
              <ErrorBox title="Could not load notes" message={recordsError} />
            ) : recordsNewestFirst.length === 0 ? (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
                <p className="text-sm text-[var(--surface-text-muted)]">
                  No notes yet for {animal.name}. Tap "Add note" to start.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="space-y-2.5">
                  {recordsNewestFirst.map((r, index) => (
                    <div key={r.id} className="relative">
                      {/* the line: from the dot above (or from this dot, for the first card) down to this dot (or to the end at the last card) */}
                      <div
                        style={{
                          position: 'absolute',
                          left: -1,
                          width: 2,
                          top: index === 0 ? '50%' : -10,
                          bottom: index === recordsNewestFirst.length - 1 ? '50%' : 0,
                          background: 'var(--accent)',
                          opacity: 0.55,
                        }}
                      />
                      {/* the dot, centred on the line */}
                      <span
                        style={{
                          position: 'absolute',
                          left: -6,
                          top: '50%',
                          width: 12,
                          height: 12,
                          marginTop: -6,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          border: '2px solid var(--bg)',
                          boxSizing: 'border-box',
                          zIndex: 10,
                        }}
                      />
                      <div
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center gap-3"
                        style={{ padding: 16, minHeight: 88, boxSizing: 'border-box' }}
                      >
                        <div className="w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center flex-shrink-0">
                          <RecordIcon type={r.record_type} size={26} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-lg leading-tight text-[var(--surface-text)]">
                              {RECORD_LABEL[r.record_type] || 'Note'}
                            </p>
                            <button
                              onClick={() => handleDeleteRecord(r.id)}
                              aria-label="Delete note"
                              className="p-1 -m-1 text-[var(--surface-text-muted)] flex-shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {r.record_type === 'weight' && (
                            <p className="text-xl font-semibold leading-tight text-[var(--surface-text)]">{weightText(r)}</p>
                          )}
                          {recordDetail(r) && (
                            <p className="text-sm leading-snug text-[var(--surface-text-muted)] break-words line-clamp-2">
                              {recordDetail(r)}
                            </p>
                          )}
                          <p className="text-sm leading-snug text-[var(--surface-text-muted)] mt-0.5">
                            {recordWhenLabel(r)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate(`/animals/${id}/add-record`)}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3.5 font-medium"
            >
              <Plus size={18} /> Add note
            </button>
            <Disclaimer />
          </div>
        )}

        {tab === 'reminders' && (
          <div className="space-y-5">
            {loadingReminders ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : remindersError ? (
              <ErrorBox title="Could not load reminders" message={remindersError} />
            ) : reminders.length === 0 ? (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
                <p className="text-sm text-[var(--surface-text-muted)]">
                  No upcoming reminders for {animal.name}.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-[var(--accent-green)] mb-2">Upcoming</p>
                  {upcomingReminders.length === 0 ? (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                      <p className="text-sm text-[var(--surface-text-muted)]">
                        Nothing due in the next {UPCOMING_DAYS} days.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingReminders.map((r) => {
                        const Icon = REMINDER_ICON[r.reminder_type] || Bell
                        const when = reminderWhen(r.due_at, false)
                        return (
                          <button
                            key={r.id}
                            onClick={() => navigate(`/reminders/${r.id}`, { state: { from_animal_id: id } })}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 text-left"
                          >
                            <div className="w-12 h-12 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                              <Icon size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[var(--surface-text)] truncate">{r.title}</p>
                              <p className="text-sm text-[var(--surface-text-muted)] truncate">
                                {[r.description || REMINDER_TYPE_LABEL[r.reminder_type] || 'Reminder', repeatPhrase(r)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <p className={`text-sm flex-shrink-0 text-right ${WHEN_TONE_CLASS[when.tone]}`}>{when.text}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {laterReminders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-[var(--accent-green)] mb-2">Later</p>
                    <div className="space-y-2">
                      {laterReminders.map((r) => {
                        const Icon = REMINDER_ICON[r.reminder_type] || Bell
                        const when = reminderWhen(r.due_at, true)
                        return (
                          <button
                            key={r.id}
                            onClick={() => navigate(`/reminders/${r.id}`, { state: { from_animal_id: id } })}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
                          >
                            <Icon size={18} className="text-[var(--accent)] flex-shrink-0" />
                            <p className="flex-1 min-w-0 text-sm text-[var(--surface-text)] truncate">
                              <span className="font-medium">{r.title}</span>
                              <span className="text-[var(--surface-text-muted)]">
                                {' '}
                                · {when.text}
                                {repeatPhrase(r) ? ` · ${repeatPhrase(r)}` : ''}
                              </span>
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => navigate('/reminders/add', { state: { animal_id: id, from_animal_id: id } })}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3.5 font-medium"
            >
              <Plus size={18} /> Add reminder
            </button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <button
                onClick={openChat}
                disabled={openingChat}
                className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium disabled:opacity-60"
              >
                <MessageCircle size={16} /> {openingChat ? 'Opening...' : 'Ask Faunly about this animal'}
              </button>
              <button
                onClick={openHealthAssistant}
                className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium text-sm"
              >
                <HeartPulse size={16} /> Health Assistant
              </button>
            </div>

            <div>
              <h3 className="font-medium mb-2">Conversations</h3>
              {loadingConversations ? (
                <p className="text-sm text-[var(--text-muted)]">Loading...</p>
              ) : conversationsError ? (
                <ErrorBox title="Could not load chats" message={conversationsError} />
              ) : conversations.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
                  <p className="text-sm text-[var(--surface-text-muted)]">
                    No conversations recorded for {animal.name} yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/history/${c.id}`)}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[var(--accent-tint)] flex items-center justify-center flex-shrink-0">
                        {c.kind === 'health' ? (
                          <HeartPulse size={16} className="text-[var(--accent)]" />
                        ) : (
                          <MessageCircle size={16} className="text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--surface-text)] truncate">{c.title}</p>
                        <p className="text-xs text-[var(--surface-text-muted)] truncate mt-1">
                          {c.last_message || 'No messages yet'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-[var(--surface-text-muted)] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Disclaimer />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
