import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { ArrowLeft, Leaf, Send, Home, Camera, PawPrint, Clock, User, ImagePlus, X, Stethoscope, HeartPulse, Pill, ShieldPlus, ClipboardList, Bot } from 'lucide-react'
import { getAnimal } from '../lib/animalsApi'
import { getGuestSessionId } from '../lib/guestSession'
import { getAuthHeader } from '../lib/auth'

const SEVERITY_STYLES = {
  monitor: { label: '⚠️ Worth keeping an eye on', color: 'text-[var(--accent)]' },
  see_vet_soon: { label: '🏥 Consider seeing a vet soon', color: 'text-[var(--accent)]' },
  emergency: { label: '🚨 This may need emergency vet care now', color: 'text-[var(--error)] font-semibold' },
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/identify', label: 'Identify', icon: Camera },
  { to: '/my-animals', label: 'My Animals', icon: PawPrint },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/profile', label: 'Profile', icon: User },
]

const STATUS_STYLE = {
  healthy: { label: 'Healthy', className: 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' },
  needs_attention: { label: 'Needs attention', className: 'bg-[var(--accent)]/20 text-[var(--accent)]' },
  not_tracked: { label: 'Not tracked', className: 'bg-[var(--surface-secondary)] text-[var(--surface-text-muted)]' },
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function suggestionsFor(animal) {
  return [
    { icon: <Stethoscope size={16} />, text: 'Is this a serious symptom?' },
    { icon: <HeartPulse size={16} />, text: 'What should I do if my pet is sick?' },
    { icon: <Pill size={16} />, text: `What are the best foods for ${animal.name}?` },
    { icon: <ShieldPlus size={16} />, text: 'How can I prevent common diseases?' },
    { icon: <ClipboardList size={16} />, text: 'Give me general care tips' },
  ]
}

export default function HealthAssistant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [animal, setAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [pendingImagePreview, setPendingImagePreview] = useState(null)
  const [sending, setSending] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    getAnimal(id).then((res) => {
      if (res.animal) setAnimal(res.animal)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleImagePick(e) {
    const file = e.target.files[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    setPendingImage({ base64, mimeType: file.type })
    setPendingImagePreview(URL.createObjectURL(file))
  }

  function clearPendingImage() {
    setPendingImage(null)
    setPendingImagePreview(null)
  }

  async function sendMessage(overrideText) {
    const trimmed = (overrideText ?? input).trim()
    if ((!trimmed && !pendingImage) || sending || limitReached) return

    const newUserMessage = {
      role: 'user',
      content: trimmed,
      image_base64: pendingImage?.base64,
      image_mime_type: pendingImage?.mimeType,
      imagePreview: pendingImagePreview,
    }
    const newMessages = [...messages, newUserMessage]
    setMessages(newMessages)
    setInput('')
    clearPendingImage()
    setSending(true)

    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(
        'https://wlgjtfqgmfgbhmjmsadr.supabase.co/functions/v1/super-service',
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task: 'chat',
            mode: 'health',
            guest_session_id: getGuestSessionId(),
            animal_id: animal.id,
            animal: {
              common_name: animal.name,
              breed: animal.attributes?.breed,
              estimated_age: animal.estimated_age,
              sex: animal.sex,
              health_status: animal.attributes?.health_status,
              notes: animal.notes,
            },
            messages: newMessages.map(({ imagePreview, ...m }) => m),
            conversation_id: conversationId,
          }),
        }
      )
      const data = await res.json()

      if (data.error === 'guest_limit_reached') {
        setLimitReached(true)
        setSending(false)
        return
      }

      if (!res.ok || data.error) {
        setMessages([...newMessages, { role: 'assistant', content: '⚠️ Something went wrong. Try again?' }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply, safety: data.safety }])
        if (data.conversation_id) setConversationId(data.conversation_id)
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '⚠️ Connection error. Try again?' }])
    } finally {
      setSending(false)
    }
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-44">
      <div className="flex items-start gap-3 px-6 pt-8 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Leaf size={16} className="text-[var(--accent-green)]" />
            <h1 className="font-display text-xl">Health Assistant</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Get guidance, answers and support for {animal.name}'s health.
          </p>
        </div>
      </div>

      <div className="px-6 mb-4">
        <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
          <div className="w-16 h-16 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {animal.photo_url ? (
              <img src={animal.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <PawPrint size={24} className="text-[var(--surface-text-muted)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--surface-text)] truncate">{animal.name}</p>
            <p className="text-sm text-[var(--surface-text-muted)] truncate">
              {animal.attributes?.breed || animal.species_label}
            </p>
            <p className="text-xs text-[var(--surface-text-muted)] mt-1">
              {animal.estimated_age ? `${animal.estimated_age} • ` : ''}{animal.sex || ''}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${status.className}`}>{status.label}</span>
        </div>
      </div>

      <div className="px-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--accent-tint)] flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--surface-text)] mb-1">Hi! I'm Faunly, your health assistant.</p>
            <p className="text-sm text-[var(--surface-text-muted)]">
              I can help with general health questions, care tips, symptoms, and when to see a vet.
              I'll use {animal.name}'s recorded details to give more relevant answers.
            </p>
            <p className="text-xs text-[var(--accent-green)] mt-2 flex items-start gap-1">
              <Leaf size={12} className="mt-0.5 flex-shrink-0" />
              Always remember: I provide guidance and education, not a medical diagnosis.
            </p>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="space-y-2 mb-4">
            {suggestionsFor(animal).map((s) => (
              <button
                key={s.text}
                onClick={() => sendMessage(s.text)}
                className="w-full flex items-center gap-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-full px-4 py-3 text-left"
              >
                <span className="text-[var(--accent)] flex-shrink-0">{s.icon}</span>
                <span className="flex-1 text-sm text-[var(--surface-text)]">{s.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m, i) => {
            const showBanner = m.role === 'assistant' && m.safety?.is_health_related && m.safety.severity !== 'info'
            const bannerStyle = showBanner ? SEVERITY_STYLES[m.safety.severity] : null

            return (
              <div key={i}>
                {bannerStyle && <p className={`text-sm mb-1 ${bannerStyle.color}`}>{bannerStyle.label}</p>}
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-[var(--bg)] ml-auto'
                      : 'bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)]'
                  }`}
                >
                  {m.imagePreview && (
                    <img src={m.imagePreview} alt="" className="w-40 h-40 object-cover rounded-xl mb-2" />
                  )}
                  {m.content}
                </div>
              </div>
            )
          })}

          {sending && (
            <div className="bg-[var(--surface)] text-[var(--surface-text-muted)] border border-[var(--border)] max-w-[80%] px-4 py-2 rounded-2xl">
              Faunly is thinking...
            </div>
          )}

          {limitReached && (
            <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-4 text-center">
              <p className="mb-3">You have used your free tries. Create an account to keep chatting.</p>
              <button
                onClick={() => navigate('/auth')}
                className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-2 rounded-full"
              >
                Sign up
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg)] z-20">
        {pendingImagePreview && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <div className="relative">
              <img src={pendingImagePreview} alt="" className="w-14 h-14 object-cover rounded-xl" />
              <button
                onClick={clearPendingImage}
                className="absolute -top-1 -right-1 bg-[var(--error)] text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">Photo ready to send</p>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
          <label className="w-11 h-11 flex-shrink-0 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center cursor-pointer text-[var(--surface-text)]">
            <ImagePlus size={18} />
            <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Ask Faunly about ${animal.name}'s health...`}
            disabled={limitReached}
            className="flex-1 bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--text-muted)] border border-[var(--border)] rounded-full px-4 py-3 outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || limitReached}
            className="bg-[var(--accent)] text-[var(--bg)] rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>

        <nav className="flex justify-around py-2 pb-[env(safe-area-inset-bottom)] border-t border-[var(--border)]">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center text-xs gap-1 px-2 py-1 ${
                  isActive ? 'text-[var(--nav-active)]' : 'text-[var(--nav-inactive)]'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
