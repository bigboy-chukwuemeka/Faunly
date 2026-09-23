import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { listAnimals } from '../lib/animalsApi'
import { createReminder, updateReminder } from '../lib/remindersApi'
import BottomNav from '../components/BottomNav'

const REMINDER_TYPES = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'medication', label: 'Medication' },
  { value: 'vet_visit', label: 'Vet Check-up' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'weight_check', label: 'Weight Check' },
  { value: 'custom', label: 'Custom' },
]

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AddReminder() {
  const navigate = useNavigate()
  const location = useLocation()
  const editReminder = location.state?.editReminder || null
  const preselectedAnimalId = location.state?.animal_id || editReminder?.animal_id || ''

  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    animal_id: preselectedAnimalId,
    reminder_type: editReminder?.reminder_type || 'vaccination',
    title: editReminder?.title || '',
    description: editReminder?.description || '',
    due_at: toDatetimeLocal(editReminder?.due_at),
    notes: editReminder?.notes || '',
  })

  useEffect(() => {
    listAnimals().then((res) => {
      if (res.animals) {
        setAnimals(res.animals)
        if (!preselectedAnimalId && res.animals.length > 0) {
          setForm((prev) => ({ ...prev, animal_id: res.animals[0].id }))
        }
      }
      setLoading(false)
    })
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.animal_id || !form.title.trim() || !form.due_at) {
      setError('Please fill in Animal, Title and Date & Time')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      animal_id: form.animal_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      reminder_type: form.reminder_type,
      due_at: new Date(form.due_at).toISOString(),
      notes: form.notes.trim() || null,
    }

    const res = editReminder
      ? await updateReminder({ reminder_id: editReminder.id, ...payload })
      : await createReminder(payload)

    setSaving(false)

    if (res.error) {
      setError(res.error)
      return
    }

    navigate(editReminder ? `/reminders/${editReminder.id}` : '/reminders')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl">{editReminder ? 'Edit Reminder' : 'Add Reminder'}</h1>
      </div>

      <div className="px-6 space-y-5">
        {/* Reminder Type */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Reminder Type
          </label>
          <div className="relative">
            <select
              value={form.reminder_type}
              onChange={(e) => update('reminder_type', e.target.value)}
              className="w-full appearance-none bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] outline-none"
            >
              {REMINDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
          </div>
        </div>

        {/* Animal */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Animal
          </label>
          <div className="relative">
            <select
              value={form.animal_id}
              onChange={(e) => update('animal_id', e.target.value)}
              className="w-full appearance-none bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] outline-none"
            >
              {animals.length === 0 && (
                <option value="">No animals yet</option>
              )}
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

        {/* Title */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Rabies vaccine"
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={form.due_at}
            onChange={(e) => update('due_at', e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Short description (optional)
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="e.g. Annual rabies vaccination"
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">
            Notes (optional)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any extra details..."
            rows={3}
            className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--error)]">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[var(--accent)] text-[var(--bg)] font-medium py-4 rounded-full disabled:opacity-50"
        >
          {saving ? 'Saving...' : editReminder ? 'Save Changes' : 'Save Reminder'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
