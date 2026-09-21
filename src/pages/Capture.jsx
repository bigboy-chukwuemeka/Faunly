import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Bookmark, Share2, CheckCircle2, Volume2, AlertTriangle,
  Leaf, Utensils, Bird, ChevronRight, MessageCircle, Camera, RefreshCw, ImageUp,
} from 'lucide-react'
import { getGuestSessionId } from '../lib/guestSession'
import { getAuthHeader } from '../lib/auth'
import { createAnimal } from '../lib/animalsApi'
import BottomNav from '../components/BottomNav'

const LOADING_MESSAGES = [
  'Uploading photo...',
  'Analyzing features...',
  'Comparing to known species...',
  'Almost there...',
]

const CONFIDENCE_STYLE = {
  high: { label: 'High Confidence', className: 'bg-[var(--accent-tint)] text-[var(--accent-green)]' },
  medium: { label: 'Medium Confidence', className: 'bg-[var(--accent-tint)] text-[var(--accent)]' },
  low: { label: 'Low Confidence', className: 'bg-[var(--error)]/15 text-[var(--error)]' },
}

const TIPS = [
  'Use a clear, well-lit photo',
  'Try to get the full animal in frame',
  'Avoid blurry or dark images',
]

export default function Capture() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [imageMimeType, setImageMimeType] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const intervalRef = useRef(null)
  const hasAutoRun = useRef(false)

  useEffect(() => {
    if (status === 'loading') {
      setLoadingMsgIndex(0)
      intervalRef.current = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
      }, 1800)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [status])

  useEffect(() => {
    const incomingFile = location.state?.file
    if (incomingFile && !hasAutoRun.current) {
      hasAutoRun.current = true
      processFile(incomingFile)
    }
  }, [location.state])

  async function identifyFromBase64(base64, mimeType) {
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
            task: 'identify',
            guest_session_id: getGuestSessionId(),
            image_base64: base64,
            mime_type: mimeType,
          }),
        }
      )
      const data = await res.json()

      if (data.error === 'guest_limit_reached') {
        setLimitReached(true)
        setStatus('error')
        return
      }

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Something went wrong')
        setStatus('error')
        return
      }

      if (data.identification.is_animal === false) {
        setStatus('uncertain')
        return
      }

      setResult(data.identification)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  async function processFile(file) {
    setImagePreview(URL.createObjectURL(file))
    setStatus('loading')
    setResult(null)
    setErrorMsg('')
    setLimitReached(false)
    setSaved(false)
    setExpanded(null)

    const base64 = await fileToBase64(file)
    setImageBase64(base64)
    setImageMimeType(file.type)

    await identifyFromBase64(base64, file.type)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSave() {
    if (!result || saving) return
    setSaving(true)

    const res = await createAnimal({
      name: result.common_name,
      species_label: result.common_name,
      breed: null,
      estimated_age: null,
      sex: null,
      health_status: 'not_tracked',
      notes: result.description || result.hook || null,
      photo_base64: imageBase64,
      photo_mime_type: imageMimeType,
    })

    setSaving(false)
    if (!res.error) {
      setSaved(true)
    } else {
      setErrorMsg('Could not save this animal. Try again.')
    }
  }

  async function handleShare() {
    if (!result) return
    const text = `${result.common_name}${result.scientific_name ? ' (' + result.scientific_name + ')' : ''} — identified with Faunly`
    if (navigator.share) {
      try {
        await navigator.share({ title: result.common_name, text })
      } catch {
        // user cancelled, ignore
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  function handleListen() {
    if (!result || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${result.common_name}. ${result.description || result.hook || ''}`)
    window.speechSynthesis.speak(utterance)
  }

  function resetToIdle() {
    setStatus('idle')
    setResult(null)
    setImagePreview(null)
    hasAutoRun.current = false
  }

  function retryIdentification() {
    if (!imageBase64 || !imageMimeType) {
      resetToIdle()
      return
    }
    setStatus('loading')
    identifyFromBase64(imageBase64, imageMimeType)
  }

  const confidenceStyle = result ? CONFIDENCE_STYLE[result.confidence] || CONFIDENCE_STYLE.medium : null
  const hasLowConfidenceAlternatives = result?.confidence !== 'high' && result?.alternatives?.length > 0

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      {status === 'idle' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
          <h1 className="font-display text-4xl mb-2">Faunly</h1>
          <p className="text-[var(--text-muted)] mb-8">Point your camera at any animal</p>
          <label className="bg-[var(--accent)] text-[var(--bg)] font-medium px-8 py-4 rounded-full text-lg cursor-pointer active:scale-95 transition flex items-center gap-2">
            <Camera size={20} /> Identify an Animal
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      )}

      {(status === 'loading' || status === 'done') && imagePreview && (
        <div className="relative">
          <img src={imagePreview} alt="" className="w-full h-72 object-cover" />
          <button
            onClick={() => navigate('/')}
            className="absolute top-6 left-4 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          {status === 'done' && (
            <div className="absolute top-6 right-4 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${saved ? 'bg-[var(--accent)] text-[var(--bg)]' : 'bg-black/40 text-white'}`}
              >
                <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
              >
                <Share2 size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center py-10 px-6 text-center">
          <div className="w-10 h-10 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--text-muted)]">{LOADING_MESSAGES[loadingMsgIndex]}</p>
        </div>
      )}

      {status === 'uncertain' && (
        <div className="px-6 mt-8 text-center">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-[var(--accent)]" />
            </div>
            <h2 className="font-display text-2xl text-[var(--surface-text)] mb-2">We couldn't identify this animal</h2>
            <p className="text-sm text-[var(--surface-text-muted)] mb-6">
              It might be unclear, the image is too dark, or it could be a species we don't have data for yet.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={retryIdentification}
                className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] font-medium py-3 rounded-full"
              >
                <RefreshCw size={16} /> Try Again
              </button>
              <label className="w-full flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] font-medium py-3 rounded-full cursor-pointer">
                <ImageUp size={16} /> Upload a Different Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            <div className="text-left">
              <p className="text-xs font-medium text-[var(--surface-text-muted)] mb-2">Tips for better results:</p>
              <ul className="text-xs text-[var(--surface-text-muted)] space-y-1">
                {TIPS.map((tip) => (
                  <li key={tip} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-[var(--accent-green)] flex-shrink-0" /> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && limitReached && (
        <div className="px-6 mt-8">
          <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-6 max-w-sm mx-auto text-center">
            <p className="mb-4">You have used your free tries. Create an account to keep exploring with Faunly.</p>
            <button
              onClick={() => navigate('/auth')}
              className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-3 rounded-full w-full"
            >
              Sign up
            </button>
          </div>
        </div>
      )}

      {status === 'error' && !limitReached && (
        <div className="px-6 mt-8 text-center">
          <p className="text-[var(--error)] mb-4">⚠️ {errorMsg}</p>
          <button onClick={resetToIdle} className="border border-[var(--border)] rounded-full px-6 py-2">
            Try again
          </button>
        </div>
      )}

      {status === 'done' && result && (
        <div className="relative -mt-6 bg-[var(--surface)] text-[var(--surface-text)] rounded-t-3xl px-6 pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${confidenceStyle.className}`}>
              <CheckCircle2 size={14} /> {confidenceStyle.label}
            </span>
            {typeof result.confidence_percent === 'number' && (
              <span className="text-sm font-medium bg-[var(--surface-secondary)] text-[var(--surface-text)] border border-[var(--border)] px-3 py-1 rounded-full">
                {result.confidence_percent}%
              </span>
            )}
          </div>

          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <h2 className="font-display text-3xl">{result.common_name}</h2>
              {result.scientific_name && (
                <p className="italic text-[var(--surface-text-muted)]">{result.scientific_name}</p>
              )}
            </div>
            <button
              onClick={handleListen}
              className="flex-shrink-0 flex items-center gap-1 text-sm bg-[var(--accent-tint)] text-[var(--accent)] px-3 py-2 rounded-full whitespace-nowrap"
            >
              <Volume2 size={16} /> Listen
            </button>
          </div>

          {result.description && (
            <p className="mb-4">{result.description}</p>
          )}

          {hasLowConfidenceAlternatives && (
            <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-2xl p-4 mb-5">
              <p className="text-xs font-medium text-[var(--error)] mb-2">Not sure? It could also be:</p>
              <ul className="text-sm space-y-1">
                {result.alternatives.map((alt, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{alt.common_name}</span>
                    <span className="text-[var(--surface-text-muted)] text-xs text-right">{alt.confidence_note}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--accent)] cursor-pointer">
                <ImageUp size={12} /> Try a clearer photo
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-5">
            <FactCard icon={<Leaf size={18} />} label="Habitat" value={result.facts?.habitat} />
            <FactCard icon={<Utensils size={18} />} label="Diet" value={result.facts?.diet} />
            <FactCard icon={<Bird size={18} />} label="Behavior" value={result.facts?.behavior} />
          </div>

          {(result.key_facts?.length || result.key_facts?.lifespan || result.facts?.conservation_status) && (
            <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-4 mb-5">
              <h3 className="font-medium mb-2">Key Facts</h3>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {result.key_facts?.length && <li><strong>Length:</strong> {result.key_facts.length}</li>}
                {result.key_facts?.lifespan && <li><strong>Lifespan:</strong> {result.key_facts.lifespan}</li>}
                {result.facts?.conservation_status && <li><strong>Conservation Status:</strong> {result.facts.conservation_status}</li>}
              </ul>
            </div>
          )}

          <div className="mb-5">
            <h3 className="font-medium mb-2">More Information</h3>
            <div className="bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-[var(--border)] rounded-2xl">
              <AccordionRow
                title="Detailed Description"
                subtitle="Appearance, features and unique traits"
                content={result.detailed_description}
                isOpen={expanded === 'description'}
                onToggle={() => setExpanded(expanded === 'description' ? null : 'description')}
              />
              <AccordionRow
                title="Conservation Status"
                subtitle="Population and threats"
                content={result.conservation_detail}
                isOpen={expanded === 'conservation'}
                onToggle={() => setExpanded(expanded === 'conservation' ? null : 'conservation')}
              />
              <AccordionRow
                title="Care Information"
                subtitle="How to support and protect"
                content={result.care_information}
                isOpen={expanded === 'care'}
                onToggle={() => setExpanded(expanded === 'care' ? null : 'care')}
              />
            </div>
          </div>

          <button
            onClick={() => navigate('/chat', { state: { animal: result, image: imagePreview } })}
            className="w-full flex items-center justify-between bg-[var(--accent-tint)] rounded-2xl p-4 mb-5"
          >
            <span className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[var(--accent)] flex-shrink-0" />
              <span className="text-left">
                <span className="block font-medium">Want to learn more?</span>
                <span className="block text-sm text-[var(--surface-text-muted)]">Ask Faunly about this animal</span>
              </span>
            </span>
            <ChevronRight size={18} className="flex-shrink-0" />
          </button>

          <div className="flex gap-3 mb-6">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex-shrink-0 flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--surface-text)] rounded-full px-5 py-3 font-medium whitespace-nowrap disabled:opacity-60"
            >
              <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => navigate('/chat', { state: { animal: result, image: imagePreview } })}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium whitespace-nowrap"
            >
              <MessageCircle size={16} className="flex-shrink-0" /> Ask Faunly
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function FactCard({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3">
      <div className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center mb-2">
        {icon}
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-[var(--surface-text-muted)] mt-1">{value}</p>
    </div>
  )
}

function AccordionRow({ title, subtitle, content, isOpen, onToggle }) {
  if (!content) return null
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <span>
          <span className="block font-medium">{title}</span>
          <span className="block text-xs text-[var(--surface-text-muted)]">{subtitle}</span>
        </span>
        <ChevronRight size={16} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <p className="px-4 pb-4 text-sm text-[var(--surface-text-muted)]">{content}</p>}
    </div>
  )
}
