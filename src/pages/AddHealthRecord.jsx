import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createHealthRecord } from '../lib/healthRecordsApi'

const TYPES = [
  { value: 'symptom', label: 'Symptom' },
  { value: 'vet_visit', label: 'Vet Visit' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'medication', label: 'Medication' },
  { value: 'note', label: 'Note' },
]

export default function AddHealthRecord() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [recordType, setRecordType] = useState('note')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Title is required.')
      return
    }
    setSaving(true)
    setErrorMsg('')

    const res = await createHealthRecord(id, {
      record_type: recordType,
      title: title.trim(),
      description: description.trim() || null,
      record_date: recordDate,
    })

    setSaving(false)
    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    navigate(`/animals/${id}`, { state: { tab: 'health' } })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <div className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl">Add Health Record</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-4">
        <Field label="Type">
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rabies vaccination" className="input" />
        </Field>

        <Field label="Date">
          <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="input" />
        </Field>

        <Field label="Details (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input resize-none" />
        </Field>

        {errorMsg && <p className="text-[var(--error)] text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[var(--accent)] text-[var(--bg)] font-medium py-3 rounded-full disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Record'}
        </button>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  )
}
