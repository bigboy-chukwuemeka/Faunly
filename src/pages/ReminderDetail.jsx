import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Syringe, Pill, Stethoscope, Calendar, PawPrint, Clock,
  CheckCircle2, Pencil, Trash2, ChevronRight,
} from 'lucide-react'
import { getReminder, completeReminder, deleteReminder } from '../lib/remindersApi'
import BottomNav from '../components/BottomNav'

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

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' • ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
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

export default function ReminderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reminder, setReminder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadReminder()
  }, [id])

  async function loadReminder() {
    setLoading(true)
    const res = await getReminder(id)
    if (res.reminder) setReminder(res.reminder)
    setLoading(false)
  }

  async function handleMarkDone() {
    setBusy(true)
    await completeReminder(id)
    setBusy(false)
    loadReminder()
  }

  async function handleDelete() {
    if (!window.confirm('Delete this reminder? This cannot be undone.')) return
    setBusy(true)
    await deleteReminder(id)
    navigate('/reminders')
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
        <p className="mb-4">Reminder not found.</p>
        <button onClick={() => navigate('/reminders')} className="text-[var(--accent)] underline">
          Back to Reminders
        </button>
      </div>
    )
  }

  const days = daysUntil(reminder.due_at)
  const animal = reminder.animals
  const typeLabel = TYPE_LABEL[reminder.reminder_type] || 'Reminder'
  const isDone = reminder.status === 'completed'

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
        {/* Reminder card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
              {TYPE_ICON[reminder.reminder_type] || <Clock size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--surface-text)]">
                {reminder.title || typeLabel}
              </p>
              {reminder.description && (
                <p className="text-sm text-[var(--surface-text-muted)] mt-0.5">
                  {reminder.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-[var(--surface-text-muted)]">
                  {formatDate(reminder.due_at)}
                </p>
                {isDone ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)] flex items-center gap-1">
                    <CheckCircle2 size={12} /> Done
                  </span>
                ) : (
                  <Badge days={days} />
                )}
              </div>
            </div>
          </div>
        </div>

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
                {animal.estimated_age ? ` • ${animal.estimated_age}` : ''}
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

        {/* Actions */}
        <div className="space-y-3 pt-2">
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
            onClick={() => navigate('/reminders/add', { state: { editReminder: reminder } })}
            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] font-medium rounded-full py-3.5"
          >
            <Pencil size={16} /> Edit Reminder
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 text-[var(--error)] font-medium py-2 disabled:opacity-50"
          >
            <Trash2 size={16} /> Delete Reminder
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
