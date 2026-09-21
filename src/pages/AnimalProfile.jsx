import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, PawPrint, MessageCircle, Pencil, Trash2, HeartPulse, Plus, Stethoscope, Syringe, Pill, FileText, X } from 'lucide-react'
import { getAnimal, deleteAnimal } from '../lib/animalsApi'
import { listHealthRecords, deleteHealthRecord } from '../lib/healthRecordsApi'
import BottomNav from '../components/BottomNav'

const STATUS_STYLE = {
  healthy: { label: 'Healthy', className: 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' },
  needs_attention: { label: 'Needs attention', className: 'bg-[var(--accent)]/20 text-[var(--accent)]' },
  not_tracked: { label: 'Not tracked', className: 'bg-[var(--surface)] text-[var(--surface-text-muted)]' },
}

const RECORD_ICON = {
  symptom: <Stethoscope size={16} />,
  vet_visit: <HeartPulse size={16} />,
  vaccination: <Syringe size={16} />,
  medication: <Pill size={16} />,
  note: <FileText size={16} />,
}

const RECORD_LABEL = {
  symptom: 'Symptom',
  vet_visit: 'Vet Visit',
  vaccination: 'Vaccination',
  medication: 'Medication',
  note: 'Note',
}

export default function AnimalProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [animal, setAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(location.state?.tab || 'overview')
  const [healthRecords, setHealthRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  useEffect(() => {
    getAnimal(id).then((res) => {
      if (res.animal) setAnimal(res.animal)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (tab === 'health') {
      setLoadingRecords(true)
      listHealthRecords(id).then((res) => {
        if (res.records) setHealthRecords(res.records)
        setLoadingRecords(false)
      })
    }
  }, [tab, id])

  async function handleDelete() {
    if (!window.confirm(`Delete ${animal.name}'s profile? This cannot be undone.`)) return
    await deleteAnimal(id)
    navigate('/my-animals')
  }

  async function handleDeleteRecord(recordId) {
    if (!window.confirm('Delete this health record?')) return
    await deleteHealthRecord(id, recordId)
    setHealthRecords((prev) => prev.filter((r) => r.id !== recordId))
  }

  function openChat() {
    navigate('/chat', {
      state: {
        animal: {
          common_name: animal.name,
          scientific_name: null,
          facts: { habitat: null, diet: null, behavior: null, conservation_status: null },
        },
      },
    })
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
        <p className="mb-4">Animal not found.</p>
        <button onClick={() => navigate('/my-animals')} className="text-[var(--accent)] underline">Back to My Animals</button>
      </div>
    )
  }

  const status = STATUS_STYLE[animal.attributes?.health_status] || STATUS_STYLE.not_tracked

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <button onClick={() => navigate('/my-animals')} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <p className="font-display text-lg">{animal.name}</p>
        <div className="w-9" />
      </div>

      <div className="px-6 mb-5">
        <div className="w-full h-48 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden mb-4">
          {animal.photo_url ? (
            <img src={animal.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <PawPrint size={40} className="text-[var(--surface-text-muted)]" />
          )}
        </div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-2xl">{animal.name}</h2>
          <span className={`text-xs px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
        </div>
        <p className="text-[var(--text-muted)] text-sm">
          {animal.attributes?.breed || animal.species_label}
          {animal.estimated_age ? ` • ${animal.estimated_age}` : ''}
          {animal.sex ? ` • ${animal.sex}` : ''}
        </p>
      </div>

      <div className="px-6 mb-5 flex bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full p-1">
        {['overview', 'health', 'history', 'more'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-sm py-1.5 rounded-full capitalize ${
              tab === t ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-6">
        {tab === 'overview' && (
          <div className="space-y-4">
            {animal.notes && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                <h3 className="font-medium mb-1">About</h3>
                <p className="text-sm text-[var(--surface-text-muted)]">{animal.notes}</p>
              </div>
            )}
            <button
              onClick={openChat}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium"
            >
              <MessageCircle size={16} /> Ask Faunly about this animal
            </button>
          </div>
        )}

        {tab === 'health' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={openHealthAssistant}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium text-sm"
              >
                <HeartPulse size={16} /> Health Assistant
              </button>
              <button
                onClick={() => navigate(`/animals/${id}/add-record`)}
                className="flex-1 flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] rounded-full py-3 font-medium text-sm"
              >
                <Plus size={16} /> Add Record
              </button>
            </div>

            <div>
              <h3 className="font-medium mb-2">Health Timeline</h3>
              {loadingRecords ? (
                <p className="text-sm text-[var(--text-muted)]">Loading...</p>
              ) : healthRecords.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
                  <p className="text-sm text-[var(--surface-text-muted)]">
                    No health records yet for {animal.name}. Tap "Add Record" to start tracking.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {healthRecords.map((r) => (
                    <div key={r.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                        {RECORD_ICON[r.record_type] || <FileText size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-[var(--surface-text)] truncate">{r.title}</p>
                          <button onClick={() => handleDeleteRecord(r.id)} className="text-[var(--surface-text-muted)] flex-shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-[var(--surface-text-muted)]">
                          {RECORD_LABEL[r.record_type]} • {new Date(r.record_date).toLocaleDateString()}
                        </p>
                        {r.description && (
                          <p className="text-sm text-[var(--surface-text-muted)] mt-1">{r.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
            <p className="text-sm text-[var(--surface-text-muted)]">
              No history recorded for {animal.name} yet.
            </p>
          </div>
        )}

        {tab === 'more' && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
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
        )}
      </div>

      <BottomNav />
    </div>
  )
}
