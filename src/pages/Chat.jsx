import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { ArrowLeft, Leaf, Send, Info, MapPin, Heart, Home, Camera, PawPrint, Clock, User, ImagePlus, X, RefreshCw } from 'lucide-react'
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

const REQUEST_TIMEOUT_MS = 45000

function suggestionsFor(animal) {
  return [
    `What does it eat?`,
    `Where does it live?`,
    `Tell me more about ${animal.common_name.toLowerCase()}.`,
  ]
}

function keyFactsSummary(animal) {
  const parts = []
  if (animal.key_facts?.length) parts.push(animal.key_facts.length)
  if (animal.key_facts?.lifespan) parts.push(animal.key_facts.lifespan)
  return parts.length ? parts.join(', ') : 'Size, lifespan, diet...'
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

export default function Chat() {
  const location = useLocation()
  const navigate = useNavigate()
  const animal = location.state?.animal
  const animalImage = location.state?.image

  const [messages, setMessages] = useState(() =>
    animal?.hook ? [{ role: 'assistant', content: animal.hook }] : []
  )
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [pendingImagePreview, setPendingImagePreview] = useState(null)
  const [sending, setSending] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [limitKind, setLimitKind] = useState(null) // 'guest' | 'daily'
  const [limitMessage, setLimitMessage] = useState('')
  const [conversationId, setConversationId] = useState(null)
  // Holds the exact message array that failed to send, so "Try Again" can
  // replay it verbatim instead of the user having to retype anything.
  // null means there is no failed send currently pending retry.
  const [pendingRetry, setPendingRetry] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  if (!animal) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-4">No animal selected.</p>
        <button onClick={() => navigate('/')} className="text-[var(--accent)] underline">
          Go back
        </button>
      </div>
    )
  }

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

  async function attemptChat(newMessages) {
    const authHeader = await getAuthHeader()
    const res = await fetchWithTimeout(
      'https://wlgjtfqgmfgbhmjmsadr.supabase.co/functions/v1/super-service',
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: 'chat',
          guest_session_id: getGuestSessionId(),
          animal,
          messages: newMessages.map(({ imagePreview, isError, ...m }) => m),
          conversation_id: conversationId,
        }),
      },
      REQUEST_TIMEOUT_MS
    )
    const data = await res.json()
    return { res, data }
  }

  // Single attempt only. On failure, we surface the error as a message
  // bubble and store the exact `newMessages` array in pendingRetry so the
  // user can retry with one tap via retryLastMessage() below, without
  // retyping anything. We never fire a second real request automatically —
  // aborting the client fetch on timeout does not stop the server, so an
  // automatic retry risks a duplicate Gemini call and a duplicate credit
  // deduction for the same message.
  async function performSend(newMessages) {
    setSending(true)
    setPendingRetry(null)

    let attempt
    try {
      attempt = await attemptChat(newMessages)
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: '⚠️ We had trouble reaching Faunly. Please check your connection and try again.',
        isError: true,
      }])
      setPendingRetry(newMessages)
      setSending(false)
      return
    }

    const { res, data } = attempt

    if (data.error === 'guest_limit_reached' || data.error === 'daily_limit_reached') {
      setLimitReached(true)
      setLimitKind(data.error === 'daily_limit_reached' ? 'daily' : 'guest')
      setLimitMessage(data.message || '')
      setSending(false)
      return
    }

    if (!res.ok || data.error) {
      const isQuotaError = res.status === 429
      setMessages([...newMessages, {
        role: 'assistant',
        content: `⚠️ ${data.error || 'Something went wrong. Try again?'}`,
        isError: true,
      }])
      // A 429 means Gemini's quota is exhausted — retrying immediately
      // would just fail again and waste another attempt, so we don't
      // offer a retry for that case specifically.
      if (!isQuotaError) setPendingRetry(newMessages)
      setSending(false)
      return
    }

    setMessages([...newMessages, { role: 'assistant', content: data.reply, safety: data.safety }])
    if (data.conversation_id) setConversationId(data.conversation_id)
    setSending(false)
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

    await performSend(newMessages)
  }

  function retryLastMessage() {
    if (!pendingRetry || sending) return
    // Strip the error bubble we appended after the failed attempt, then
    // resend the exact same message array that failed.
    setMessages((prev) => prev.filter((m) => !m.isError))
    performSend(pendingRetry)
  }

  const showSuggestions = messages.length <= 1 && !sending

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-44">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="font-display text-lg leading-none">Faunly</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">AI Animal Assistant</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 mb-4">
          {animalImage ? (
            <img src={animalImage} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-tint)] flex items-center justify-center flex-shrink-0">
              <Leaf size={20} className="text-[var(--accent)]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--surface-text)] truncate">{animal.common_name}</p>
            {animal.scientific_name && (
              <p className="text-xs italic text-[var(--surface-text-muted)] truncate">{animal.scientific_name}</p>
            )}
          </div>
          {typeof animal.confidence_percent === 'number' && (
            <span className="text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent)] px-2 py-1 rounded-full flex-shrink-0">
              {animal.confidence_percent}%
            </span>
          )}
        </div>

        {messages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniFact icon={<Info size={16} />} label="Key Facts" sub={keyFactsSummary(animal)} />
            <MiniFact icon={<MapPin size={16} />} label="Habitat" sub={animal.facts?.habitat || 'Unknown'} />
            <MiniFact icon={<Heart size={16} />} label="Care Tips" sub="What they need" />
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

          {showSuggestions && (
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestionsFor(animal).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-sm bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--surface-text)] px-3 py-2 rounded-full"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {sending && (
            <div className="bg-[var(--surface)] text-[var(--surface-text-muted)] border border-[var(--border)] max-w-[80%] px-4 py-2 rounded-2xl">
              Faunly is thinking...
            </div>
          )}

          {pendingRetry && !sending && (
            <button
              onClick={retryLastMessage}
              className="flex items-center gap-2 text-sm bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--surface-text)] px-4 py-2 rounded-full"
            >
              <RefreshCw size={14} /> Try Again
            </button>
          )}

          {limitReached && limitKind === 'guest' && (
            <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-4 text-center">
              <p className="mb-3">{limitMessage || 'You have used your free tries. Create an account to keep chatting.'}</p>
              <button
                onClick={() => navigate('/auth')}
                className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-2 rounded-full"
              >
                Sign up
              </button>
            </div>
          )}

          {limitReached && limitKind === 'daily' && (
            <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-4 text-center">
              <p className="mb-3">{limitMessage || 'You have reached your daily AI limit. It resets in 24 hours.'}</p>
              <button
                onClick={() => navigate('/')}
                className="border border-[var(--border)] text-[var(--surface-text)] font-medium px-6 py-2 rounded-full"
              >
                Back to Home
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
            placeholder="Type a message..."
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

function MiniFact({ icon, label, sub }) {
  return (
    <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3">
      <div className="text-[var(--accent)] mb-2">{icon}</div>
      <p className="text-xs font-medium text-[var(--surface-text)]">{label}</p>
      <p className="text-[10px] text-[var(--surface-text-muted)] truncate">{sub}</p>
    </div>
  )
}
