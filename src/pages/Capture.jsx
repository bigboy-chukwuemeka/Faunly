import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Bookmark, Share2, CheckCircle2, AlertTriangle,
  ChevronRight, MessageCircle, Camera, RefreshCw, ImageUp,
} from 'lucide-react'
import { getGuestSessionId } from '../lib/guestSession'
import { getAuthHeader } from '../lib/auth'
import { createAnimal } from '../lib/animalsApi'
import BottomNav from '../components/BottomNav'
import IdentificationResultCard from '../components/IdentificationResultCard'

const LOADING_MESSAGES = [
  'Uploading photo...',
  'Analyzing features...',
  'Comparing to known species...',
  'Almost there...',
]

const TIPS = [
  'Use a clear, well-lit photo',
  'Try to get the full animal in frame',
  'Avoid blurry or dark images',
]

const MAX_IMAGE_DIMENSION = 1024
const IMAGE_QUALITY = 0.85
const REQUEST_TIMEOUT_MS = 45000

function resizeImage(file, maxDimension = MAX_IMAGE_DIMENSION, quality = IMAGE_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      URL.revokeObjectURL(objectUrl)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Could not process image'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    img.src = objectUrl
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

export default function Capture() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [resultConversationId, setResultConversationId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorStatus, setErrorStatus] = useState(null)
  const [limitReached, setLimitReached] = useState(false)
  const [limitKind, setLimitKind] = useState(null) // 'guest' | 'daily'
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

  async function attemptIdentify(base64, mimeType) {
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
          task: 'identify',
          guest_session_id: getGuestSessionId(),
          image_base64: base64,
          mime_type: mimeType,
        }),
      },
      REQUEST_TIMEOUT_MS
    )
    const data = await res.json()
    return { res, data }
  }

  async function identifyFromBase64(base64, mimeType) {
    setErrorStatus(null)

    let attempt
    try {
      attempt = await attemptIdentify(base64, mimeType)
    } catch {
      setErrorMsg('We had trouble reaching Faunly. Please check your connection and try again.')
      setStatus('error')
      return
    }

    const { res, data } = attempt

    if (data.error === 'guest_limit_reached' || data.error === 'daily_limit_reached') {
      setLimitReached(true)
      setLimitKind(data.error === 'daily_limit_reached' ? 'daily' : 'guest')
      setErrorMsg(data.message || '')
      setStatus('error')
      return
    }

    if (!res.ok || data.error) {
      setErrorMsg(data.error || 'Something went wrong. Please try again.')
      setErrorStatus(res.status)
      setStatus('error')
      return
    }

    if (data.identification.is_animal === false) {
      setStatus('uncertain')
      return
    }

    setResult(data.identification)
    setResultConversationId(data.conversation_id || null)
    setStatus('done')
  }

  async function processFile(file) {
    setStatus('loading')
    setResult(null)
    setResultConversationId(null)
    setErrorMsg('')
    setErrorStatus(null)
    setLimitReached(false)
    setLimitKind(null)
    setSaved(false)
    setExpanded(null)

    let workingFile = file
    try {
      workingFile = await resizeImage(file)
    } catch {
      workingFile = file
    }

    setImagePreview(URL.createObjectURL(workingFile))

    const mimeType = workingFile.type || 'image/jpeg'
    const base64 = await fileToBase64(workingFile)
    setImageBase64(base64)
    setImageMimeType(mimeType)

    await identifyFromBase64(base64, mimeType)
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
    setResultConversationId(null)
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

  function goToChat() {
    navigate('/chat', {
      state: {
        animal: result,
        image: imagePreview,
        sourceConversationId: resultConversationId,
      },
    })
  }

  const isQuotaError = errorStatus === 429

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

      {status === 'error' && limitReached && limitKind === 'guest' && (
        <div className="px-6 mt-8">
          <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-6 max-w-sm mx-auto text-center">
            <p className="mb-4">{errorMsg || 'You have used your free tries. Create an account to keep exploring with Faunly.'}</p>
            <button
              onClick={() => navigate('/auth')}
              className="bg-[var(--accent)] text-[var(--bg)] font-medium px-6 py-3 rounded-full w-full"
            >
              Sign up
            </button>
          </div>
        </div>
      )}

      {status === 'error' && limitReached && limitKind === 'daily' && (
        <div className="px-6 mt-8">
          <div className="bg-[var(--surface)] text-[var(--surface-text)] border border-[var(--border)] rounded-2xl p-6 max-w-sm mx-auto text-center">
            <p className="mb-4">{errorMsg || 'You have reached your daily AI limit. It resets in 24 hours.'}</p>
            <button
              onClick={() => navigate('/')}
              className="border border-[var(--border)] text-[var(--surface-text)] font-medium px-6 py-3 rounded-full w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {status === 'error' && !limitReached && (
        <div className="px-6 mt-8 text-center">
          <p className="text-[var(--error)] mb-4">⚠️ {errorMsg}</p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {!isQuotaError && (
              <button
                onClick={retryIdentification}
                className="flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] font-medium rounded-full px-6 py-3"
              >
                <RefreshCw size={16} /> Try Again
              </button>
            )}
            <button onClick={resetToIdle} className="border border-[var(--border)] rounded-full px-6 py-2">
              {isQuotaError ? 'Back to Home' : 'Choose a Different Photo'}
            </button>
          </div>
        </div>
      )}

      {status === 'done' && result && (
        <div className="relative -mt-6 bg-[var(--surface)] text-[var(--surface-text)] rounded-t-3xl px-6 pt-6">
          <IdentificationResultCard
            result={result}
            expanded={expanded}
            onToggleExpand={(key) => setExpanded(expanded === key ? null : key)}
            onListen={handleListen}
            onRetryPhoto={handleFileChange}
          />

          <button
            onClick={goToChat}
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
              onClick={goToChat}
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
