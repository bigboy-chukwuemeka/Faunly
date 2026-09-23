import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Syringe, Pill, Stethoscope, Calendar,
  PawPrint, Clock, CheckCircle2, ChevronRight
} from 'lucide-react'
import { listReminders, completeReminder } from '../lib/remindersApi'
import BottomNav from '../components/BottomNav'

const TYPE_ICON = {
  vaccination: <Syringe size={18} />,
  medication: <Pill size={18} />,
  vet_visit: <Stethoscope size={18} />,
  follow_up: <Calendar size={18} />,
  weight_check: <PawPrint size={18} />,
  custom: <Clock size={18} />,
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
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  return diff
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

export default function Reminders() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('upcoming')
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReminders()
  }, [tab])

  async function loadReminders() {
    setLoading(true)
    const status = tab === 'all' ? 'all' : tab === 'upcoming' ? 'pending' : 'completed'
    const res = await listReminders({ status })
    if (res.reminders) {
      setReminders(res.reminders)
    }
    setLoading(false)
  }

  async function handleMarkDone(e, id) {
    e.stopPropagation()
    await completeReminder(id)
    loadReminders()
  }

  const filtered = reminders.filter((r) => {
    if (tab === 'upcoming') return r.status === 'pending'
    if (tab === 'past') return r.status === 'completed' || r.status === 'dismissed'
    return true
  })

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
        <h1 className="font-display text-xl">Reminders</h1>
        <button
          onClick={() => navigate('/reminders/add')}
          className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-5">
        <div className="flex bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full p-1">
          {['upcoming', 'past', 'all'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-sm py-1.5 rounded-full capitalize ${
                tab === t
                  ? 'bg-[var(--text)] text-[var(--bg)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-6 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            Loading reminders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <Clock size={32} className="mx-auto mb-3 text-[var(--accent-green)]" />
            <p className="font-medium text-[var(--surface-text)] mb-1">
              No reminders yet
            </p>
            <p className="text-sm text-[var(--surface-text-muted)] mb-5">
              Add vaccination due dates, medication schedules, or follow-ups so you never miss important care moments.
            </p>
            <button
              onClick={() => navigate('/reminders/add')}
              className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-3 rounded-full inline-flex items-center gap-2"
            >
              <Plus size={16} /> Add Reminder
            </button>
          </div>
        ) : (
          filtered.map((r) => {
            const days = daysUntil(r.due_at)
            const animalName = r.animals?.name || 'Animal'
            const typeLabel = TYPE_LABEL[r.reminder_type] || 'Reminder'

            return (
              <div
                key={r.id}
                onClick={() => navigate(`/reminders/${r.id}`)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                    {TYPE_ICON[r.reminder_type] || <Clock size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--surface-text)]">
                          {r.title || typeLabel}
                        </p>
                        {r.description && (
                          <p className="text-sm text-[var(--surface-text-muted)] mt-0.5">
                            {r.description}
                          </p>
                        )}
                      </div>
                      {r.status === 'pending' && <Badge days={days} />}
                      {r.status === 'completed' && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent-green)]/20 text-[var(--accent-green)] flex items-center gap-1">
                          <CheckCircle2 size={12} /> Done
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--surface-text-muted)] mt-2">
                      {formatDate(r.due_at)}
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden">
                          <PawPrint size={12} className="text-[var(--surface-text-muted)]" />
                        </div>
                        <span className="text-xs text-[var(--surface-text-muted)]">
                          {animalName}
                        </span>
                      </div>

                      {r.status === 'pending' && (
                        <button
                          onClick={(e) => handleMarkDone(e, r.id)}
                          className="text-xs font-medium text-[var(--accent)] flex items-center gap-1"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
