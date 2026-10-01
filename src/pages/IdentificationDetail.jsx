import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { getIdentification } from '../lib/historyApi'
import IdentificationResultCard from '../components/IdentificationResultCard'
import BottomNav from '../components/BottomNav'

export default function IdentificationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [identification, setIdentification] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getIdentification(id).then((res) => {
      if (res.identification) {
        setIdentification(res.identification)
        setPhotoUrl(res.photo_url || null)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [id])

  function handleListen() {
    if (!identification || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${identification.common_name}. ${identification.description || identification.hook || ''}`)
    window.speechSynthesis.speak(utterance)
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">Loading...</div>
  }

  if (notFound || !identification) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center px-6 text-center">
        <p className="mb-4">Identification not found.</p>
        <button onClick={() => navigate('/history')} className="text-[var(--accent)] underline">Back to History</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="relative">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-72 object-cover" />
        ) : (
          <div className="w-full h-40 bg-[var(--surface-secondary)]" />
        )}
        <button
          onClick={() => navigate('/history')}
          className="absolute top-6 left-4 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="relative -mt-6 bg-[var(--surface)] text-[var(--surface-text)] rounded-t-3xl px-6 pt-6">
        <IdentificationResultCard
          result={identification}
          expanded={expanded}
          onToggleExpand={(key) => setExpanded(expanded === key ? null : key)}
          onListen={handleListen}
        />

        <button
          onClick={() => navigate('/chat', { state: { animal: identification, image: photoUrl } })}
          className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--bg)] rounded-full py-3 font-medium mb-6"
        >
          <MessageCircle size={16} /> Ask Faunly about this animal
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
