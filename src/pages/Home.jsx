import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image as ImageIcon, MessageCircle, HeartPulse, PawPrint, Clock, Settings, Bird, Sparkles, Leaf, User, ChevronRight } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { listAnimals } from '../lib/animalsApi'
import { listIdentifications, listConversations } from '../lib/historyApi'
import BottomNav from '../components/BottomNav'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const CONFIDENCE_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const ACTIVITY_BG = '#E9E2D0'
const ACTIVITY_TEXT = '#2A2418'
const ACTIVITY_TEXT_MUTED = '#6B6250'

export default function Home() {
  const navigate = useNavigate()
  const { user, avatarUrl } = useAuth()
  const [heroPhotos, setHeroPhotos] = useState([])
  const [heroIndex, setHeroIndex] = useState(0)
  const [recentActivity, setRecentActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    listAnimals().then((res) => {
      if (!res.animals) return

      const withPhotos = res.animals.filter((a) => a.photo_url).slice(0, 3)
      setHeroPhotos(withPhotos)

      const photoByName = {}
      for (const a of res.animals) {
        if (a.photo_url) photoByName[a.name.toLowerCase()] = a.photo_url
      }

      Promise.all([listIdentifications(), listConversations()]).then(([ids, convos]) => {
        const idItems = (ids.identifications || []).map((i) => ({
          type: 'identification',
          key: `id-${i.id}`,
          title: i.common_name,
          subtitle: `Identified ${timeAgo(i.created_at)}`,
          confidence: i.confidence,
          date: i.created_at,
          photoUrl: photoByName[i.common_name?.toLowerCase()] || null,
        }))
        const convoItems = (convos.conversations || []).map((c) => ({
          type: 'conversation',
          key: `convo-${c.id}`,
          title: c.title,
          subtitle: `Last message ${timeAgo(c.updated_at)}`,
          date: c.updated_at,
          id: c.id,
          photoUrl: photoByName[c.title?.toLowerCase()] || null,
        }))
        const merged = [...idItems, ...convoItems]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 4)
        setRecentActivity(merged)
        setLoadingActivity(false)
      })
    })
  }, [])

  useEffect(() => {
    if (heroPhotos.length <= 1) return
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroPhotos.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [heroPhotos])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    navigate('/identify', { state: { file } })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="flex items-center justify-between px-6 pt-8 pb-2">
        <div>
          <h1 className="font-display text-2xl leading-none">Faunly</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">AI Animal Assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="px-6 mt-8 mb-6">
        <h2 className="text-xl font-medium">
          {getGreeting()}{user ? `, ${user.email.split('@')[0]}` : ''}
        </h2>
        <p className="text-[var(--text-muted)] mt-1">
          Your AI companion for understanding, protecting and caring for animals.
        </p>
      </div>

      <div className="mx-6 mb-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-5">
        <span className="inline-flex items-center gap-1 bg-[var(--surface-secondary)] text-[var(--accent)] text-xs px-3 py-1 rounded-full mb-4 border border-[var(--border)]">
          <Sparkles size={12} /> AI Powered
        </span>

        <div className="flex gap-4 mb-5">
          <div className="flex-1">
            <h3 className="font-display text-2xl leading-tight mb-2 text-[var(--surface-text)]">Identify an Animal</h3>
            <p className="text-[var(--surface-text-muted)] text-sm">
              Take a photo or upload an image to learn more about any animal.
            </p>
          </div>

          <div className="flex-shrink-0 w-28 flex flex-col items-center gap-2">
            <div className="relative w-28 h-36 rounded-2xl overflow-hidden bg-[var(--accent-tint)]">
              {heroPhotos.length > 0 ? (
                <img
                  src={heroPhotos[heroIndex].photo_url}
                  alt=""
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Bird size={40} className="text-[var(--accent)]" />
                </div>
              )}
            </div>
            {heroPhotos.length > 1 && (
              <div className="flex gap-1">
                {heroPhotos.map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i === heroIndex ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex-1 bg-[var(--accent)] text-[var(--bg)] font-medium rounded-full py-3 flex items-center justify-center gap-2 cursor-pointer">
            <Camera size={18} strokeWidth={2} />
            <span>Open Camera</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>
          <label className="w-12 h-12 flex-shrink-0 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center cursor-pointer text-[var(--surface-text)]">
            <ImageIcon size={18} />
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 mb-8">
        <QuickCard icon={<MessageCircle size={20} />} title="Ask Faunly" subtitle="Chat about any animal" onClick={() => navigate('/identify')} />
        <QuickCard icon={<HeartPulse size={20} />} title="Animal Health" subtitle="Care tips & guidance" onClick={() => navigate('/identify')} />
        <QuickCard icon={<PawPrint size={20} />} title="My Animals" subtitle="Your saved animals" onClick={() => navigate('/my-animals')} />
        <QuickCard icon={<Clock size={20} />} title="History" subtitle="Past searches & chats" onClick={() => navigate('/history')} />
      </div>

      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Recent Activity</h3>
          <button onClick={() => navigate('/history')} className="text-sm text-[var(--accent)] flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>

        {loadingActivity ? (
          <div style={{ backgroundColor: ACTIVITY_BG, color: ACTIVITY_TEXT_MUTED }} className="rounded-2xl p-6 text-center text-sm">
            Loading...
          </div>
        ) : recentActivity.length === 0 ? (
          <div style={{ backgroundColor: ACTIVITY_BG, color: ACTIVITY_TEXT_MUTED }} className="rounded-2xl p-6 text-center text-sm">
            Nothing here yet — identify your first animal to start building your history.
          </div>
        ) : (
          <div style={{ backgroundColor: ACTIVITY_BG, color: ACTIVITY_TEXT }} className="rounded-2xl overflow-hidden">
            {recentActivity.map((item, i) => (
              <button
                key={item.key}
                onClick={() => item.type === 'conversation' ? navigate(`/history/${item.id}`) : navigate('/history')}
                style={i > 0 ? { borderTop: '1px solid rgba(0,0,0,0.1)' } : undefined}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                  {item.photoUrl ? (
                    <img src={item.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : item.type === 'conversation' ? (
                    <MessageCircle size={18} style={{ opacity: 0.7 }} />
                  ) : (
                    <PawPrint size={18} style={{ opacity: 0.7 }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-xs truncate" style={{ color: ACTIVITY_TEXT_MUTED }}>{item.subtitle}</p>
                </div>
                {item.confidence && (
                  <span className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(127,175,140,0.25)', color: '#3D5C46' }}>
                    {CONFIDENCE_LABEL[item.confidence] || item.confidence}
                  </span>
                )}
                <ChevronRight size={16} style={{ opacity: 0.4 }} className="flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-6 mb-8 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] p-4 flex items-center gap-3">
        <Leaf size={20} className="text-[var(--accent-green)] flex-shrink-0" />
        <p className="text-sm text-[var(--surface-text-muted)]">
          Faunly provides trusted information, helpful guidance and smart AI conversations for your animal journey.
        </p>
        <PawPrint size={20} className="text-[var(--accent-green)] flex-shrink-0" />
      </div>

      <BottomNav />
    </div>
  )
}

function QuickCard({ icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-4 text-left"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--accent-tint)] flex items-center justify-center mb-3 text-[var(--accent)]">
        {icon}
      </div>
      <p className="font-medium text-[var(--surface-text)]">{title}</p>
      <p className="text-xs text-[var(--surface-text-muted)] mt-1">{subtitle}</p>
    </button>
  )
}
