import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { signUp, signIn } from '../lib/auth'
import { migrateGuest } from '../lib/animalsApi'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.redirectTo || '/'

  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setInfoMsg('')

    const result = mode === 'signup'
      ? await signUp(email, password)
      : await signIn(email, password)

    if (result.error) {
      setErrorMsg(result.error.message)
      setLoading(false)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setInfoMsg('Check your email to confirm your account, then log in.')
      setLoading(false)
      return
    }

    await migrateGuest()
    setLoading(false)
    navigate(redirectTo)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col px-6 py-10">
      <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center mb-8">
        <ArrowLeft size={18} />
      </button>

      <h1 className="font-display text-3xl mb-2">
        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="text-[var(--text-muted)] mb-8 text-sm">
        {mode === 'signup'
          ? 'Save your animals, photos, and conversations for good.'
          : 'Log in to see your saved animals.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] rounded-xl px-4 py-3"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] rounded-xl px-4 py-3"
        />

        {errorMsg && <p className="text-[var(--error)] text-sm">{errorMsg}</p>}
        {infoMsg && <p className="text-[var(--accent-green)] text-sm">{infoMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] text-[var(--bg)] font-medium py-3 rounded-full disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErrorMsg(''); setInfoMsg('') }}
        className="text-center text-sm text-[var(--accent)] mt-6"
      >
        {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
