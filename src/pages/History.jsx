import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight, MessageCircle } from 'lucide-react'
import { listIdentifications, listConversations } from '../lib/historyApi'
import BottomNav from '../components/BottomNav'

const CONFIDENCE_LABEL = { high: 'High Confidence', medium: 'Medium Confidence', low: 'Low Confidence' }

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

export default function History() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('identifications')
  const [identifications, setIdentifications] = useState([])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listIdentifications(), listConversations()]).then(([ids, convos]) => {
      if (ids.identifications) setIdentifications(ids.identifications)
      if (convos.conversations) setConversations(convos.conversations)
      setLoading(false)
    })
  }, [])

  const items = tab === 'identifications' ? identifications : conversations
  const isEmpty = !loading && items.length === 0

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-display text-2xl">History</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Everything you've identified and discussed with Faunly.
        </p>
      </div>

      <div className="px-6 mb-4">
        <div className="flex bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full p-1">
          {['identifications', 'conversations'].map((t) => (
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
      </div>

      <div className="px-6 space-y-3">
        {tab === 'identifications' && identifications.map((item) => (
          <div key={item.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--surface-text)] truncate">{item.common_name}</p>
              <p className="text-xs text-[var(--surface-text-muted)] mt-1">
                Identified {timeAgo(item.created_at)}
              </p>
            </div>
            {item.confidence && (
              <span className="text-xs bg-[var(--accent-tint)] text-[var(--accent)] px-2 py-1 rounded-full flex-shrink-0">
                {CONFIDENCE_LABEL[item.confidence] || item.confidence}
              </span>
            )}
          </div>
        ))}

        {tab === 'conversations' && conversations.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/history/${item.id}`)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--accent-tint)] flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--surface-text)] truncate">{item.title}</p>
              <p className="text-xs text-[var(--surface-text-muted)] truncate mt-1">
                {item.last_message || 'No messages yet'}
              </p>
            </div>
            <ChevronRight size={16} className="text-[var(--surface-text-muted)] flex-shrink-0" />
          </button>
        ))}
      </div>

      {isEmpty && (
        <div className="px-6 mt-8">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <Clock size={28} className="mx-auto mb-3 text-[var(--accent-green)]" />
            <p className="font-medium text-[var(--surface-text)] mb-1">Nothing here yet</p>
            <p className="text-sm text-[var(--surface-text-muted)]">
              {tab === 'identifications'
                ? 'Identify an animal to see it show up here.'
                : 'Start a chat with Faunly to see it show up here.'}
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
