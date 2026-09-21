import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PawPrint, Plus, User, HeartPulse, Clock, ChevronRight } from 'lucide-react'
import { getSavedAnimals } from '../lib/savedAnimals'
import { listAnimals } from '../lib/animalsApi'
import BottomNav from '../components/BottomNav'

const STATUS_STYLE = {
  healthy: { label: 'Healthy', className: 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' },
  needs_attention: { label: 'Needs attention', className: 'bg-[var(--accent)]/20 text-[var(--accent)]' },
  not_tracked: { label: 'Not tracked', className: 'bg-[var(--surface)] text-[var(--surface-text-muted)]' },
}

export default function MyAnimals() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [profiles, setProfiles] = useState([])
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSaved(getSavedAnimals())
    listAnimals().then((res) => {
      if (res.animals) setProfiles(res.animals)
      setLoading(false)
    })
  }, [])

  const showProfiles = tab === 'all' || tab === 'profiles'
  const showSaved = tab === 'all' || tab === 'saved'
  const isEmpty = !loading && profiles.length === 0 && saved.length === 0

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="flex items-center justify-between px-6 pt-8 pb-2">
        <h1 className="font-display text-2xl leading-none">Faunly</h1>
      </div>

      <div className="px-6 pb-4">
        <h2 className="font-display text-3xl mb-2">My Animals</h2>
        <p className="text-[var(--text-muted)] text-sm">
          Manage your animal profiles and keep track of their health and history.
        </p>
      </div>

      <div className="px-6 pb-4 flex items-center gap-2">
        <div className="flex bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full p-1 flex-1">
          {['all', 'saved', 'profiles'].map((t) => (
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
        <button
          onClick={() => navigate('/add-animal')}
          className="flex items-center gap-1 bg-[var(--accent)] text-[var(--bg)] text-sm font-medium px-3 py-2 rounded-full flex-shrink-0"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="px-6 space-y-3">
        {showProfiles && profiles.map((a) => (
          <ProfileCard key={a.id} animal={a} onOpen={(tabName) => navigate(`/animals/${a.id}`, { state: { tab: tabName } })} />
        ))}

        {showSaved && saved.map((a, i) => (
          <SavedCard key={i} animal={a} onChat={() => navigate('/chat', { state: { animal: a } })} onMakeProfile={() => navigate('/add-animal', { state: { prefill: a } })} />
        ))}
      </div>

      {isEmpty && (
        <div className="px-6 mt-8">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <PawPrint size={32} className="mx-auto mb-3 text-[var(--accent-green)]" />
            <p className="font-medium text-[var(--surface-text)] mb-1">No animals yet</p>
            <p className="text-sm text-[var(--surface-text-muted)] mb-4">
              Add your first animal to get started with Faunly.
            </p>
            <button
              onClick={() => navigate('/add-animal')}
              className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-3 rounded-full inline-flex items-center gap-2"
            >
              <Plus size={16} /> Add Animal
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function ProfileCard({ animal, onOpen }) {
  const status = STATUS_STYLE[animal.attributes?.health_status] || STATUS_STYLE.not_tracked
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <button onClick={() => onOpen('overview')} className="w-full flex items-center gap-3 mb-3">
        <div className="w-16 h-16 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {animal.photo_url ? (
            <img src={animal.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <PawPrint size={24} className="text-[var(--surface-text-muted)]" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-[var(--surface-text)] truncate">{animal.name}</p>
            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${status.className}`}>{status.label}</span>
          </div>
          <p className="text-sm text-[var(--surface-text-muted)] truncate">
            {animal.attributes?.breed || animal.species_label}
          </p>
          <p className="text-xs text-[var(--surface-text-muted)] mt-1">
            {animal.estimated_age ? `${animal.estimated_age} • ` : ''}{animal.sex || ''}
          </p>
        </div>
        <ChevronRight size={18} className="text-[var(--surface-text-muted)] flex-shrink-0" />
      </button>
      <div className="flex gap-2 border-t border-[var(--border)] pt-3">
        <QuickAction icon={<User size={14} />} label="Profile" onClick={() => onOpen('overview')} />
        <QuickAction icon={<HeartPulse size={14} />} label="Health" onClick={() => onOpen('health')} />
        <QuickAction icon={<Clock size={14} />} label="History" onClick={() => onOpen('history')} />
      </div>
    </div>
  )
}

function SavedCard({ animal, onChat, onMakeProfile }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-16 h-16 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center flex-shrink-0">
          <PawPrint size={24} className="text-[var(--surface-text-muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--surface-text)] truncate">{animal.common_name}</p>
          {animal.scientific_name && (
            <p className="text-xs italic text-[var(--surface-text-muted)] truncate">{animal.scientific_name}</p>
          )}
          <p className="text-xs text-[var(--surface-text-muted)] mt-1">
            Saved from identification, no profile yet
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-[var(--border)] pt-3">
        <QuickAction icon={<User size={14} />} label="Chat" onClick={onChat} />
        <QuickAction icon={<Plus size={14} />} label="Make Profile" onClick={onMakeProfile} />
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex items-center justify-center gap-1 text-xs text-[var(--surface-text-muted)] py-1.5 rounded-full bg-[var(--surface-secondary)]">
      {icon} {label}
    </button>
  )
}
