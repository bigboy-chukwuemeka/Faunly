import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Crown, CreditCard, Palette, Bell, Globe,
  ShieldCheck, HelpCircle, FileText, Info, ChevronRight, LogOut, Camera,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { signOut } from '../lib/auth'
import { uploadAvatar } from '../lib/profileApi'
import BottomNav from '../components/BottomNav'

export default function Profile() {
  const navigate = useNavigate()
  const { user, avatarUrl, refreshProfile } = useAuth()
  const [avatarError, setAvatarError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file || !user) return
    setUploading(true)
    setAvatarError('')
    const result = await uploadAvatar(user.id, file)
    setUploading(false)
    if (result.error) {
      setAvatarError(result.error)
    } else {
      await refreshProfile(user)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-24">
      <div className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl leading-none">Faunly</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Settings</p>
        </div>
      </div>

      <div className="mx-6 mb-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 flex items-center gap-4">
        <label className="relative w-14 h-14 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={24} className="text-[var(--surface-text-muted)]" />
          )}
          {user && (
            <>
              <div className="absolute bottom-0 right-0 bg-[var(--accent)] rounded-full p-1">
                <Camera size={10} className="text-[var(--bg)]" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </>
          )}
        </label>
        <div className="flex-1 min-w-0">
          {user ? (
            <>
              <p className="font-medium text-[var(--surface-text)] truncate">{user.email}</p>
              <span className="inline-block mt-1 text-xs bg-[var(--accent-tint)] text-[var(--accent)] px-2 py-0.5 rounded-full">Free Plan</span>
            </>
          ) : (
            <>
              <p className="font-medium text-[var(--surface-text)]">Guest</p>
              <p className="text-xs text-[var(--surface-text-muted)]">Sign up to save your account</p>
            </>
          )}
        </div>
        {!user && (
          <button
            onClick={() => navigate('/auth')}
            className="bg-[var(--accent)] text-[var(--bg)] text-xs font-medium px-3 py-2 rounded-full flex-shrink-0"
          >
            Sign up
          </button>
        )}
      </div>

      {uploading && <p className="mx-6 mb-2 text-xs text-[var(--text-muted)]">Uploading photo...</p>}
      {avatarError && <p className="mx-6 mb-4 text-xs text-[var(--error)]">⚠️ {avatarError}</p>}
      {!uploading && !avatarError && <div className="mb-6" />}

      <Section title="Account & Subscription">
        <Row icon={<User size={18} />} label="Account Settings" sub={user ? 'Update your profile' : 'Sign up to manage your profile'} locked={!user} />
        <Row icon={<Crown size={18} />} label="Subscription & Credits" sub="View plan, credits and upgrade options" locked />
        <Row icon={<CreditCard size={18} />} label="Payment Methods" sub="Manage your payment methods" locked />
      </Section>

      <Section title="App Preferences">
        <Row icon={<Palette size={18} />} label="Theme" sub="Dark (only option for now)" />
        <Row icon={<Bell size={18} />} label="Notifications" sub="Coming soon" locked />
        <Row icon={<Globe size={18} />} label="Language" sub="English" />
        <Row icon={<ShieldCheck size={18} />} label="Privacy & Security" sub="Coming soon" locked />
      </Section>

      <Section title="Support & About">
        <Row icon={<HelpCircle size={18} />} label="Help & Support" sub="Coming soon" locked />
        <Row icon={<FileText size={18} />} label="Terms of Service" sub="Coming soon" locked />
        <Row icon={<ShieldCheck size={18} />} label="Privacy Policy" sub="Coming soon" locked />
        <Row icon={<Info size={18} />} label="About Faunly" sub="Version 0.1.0 (early build)" />
      </Section>

      {user && (
        <div className="px-6 mb-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--error)] rounded-2xl py-3 font-medium"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="px-6 mb-6">
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2 px-1">{title}</h3>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
        {children}
      </div>
    </div>
  )
}

function Row({ icon, label, sub, locked }) {
  return (
    <div className={`flex items-center gap-3 p-4 ${locked ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--surface-text)]">{label}</p>
        <p className="text-xs text-[var(--surface-text-muted)]">{sub}</p>
      </div>
      <ChevronRight size={16} className="text-[var(--surface-text-muted)]" />
    </div>
  )
}
