import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { onAuthChange } from './auth'
import { getProfileAvatar } from './profileApi'

const AuthContext = createContext({ user: null, loading: true, avatarUrl: null, refreshProfile: () => {} })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const refreshProfile = useCallback(async (targetUser) => {
    if (!targetUser) {
      setAvatarUrl(null)
      return
    }
    const { avatarUrl: url } = await getProfileAvatar(targetUser.id)
    setAvatarUrl(url)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null
      setUser(u)
      setLoading(false)
      if (u) refreshProfile(u)
    })

    const { data: listener } = onAuthChange((u) => {
      setUser(u)
      if (u) refreshProfile(u)
      else setAvatarUrl(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [refreshProfile])

  return (
    <AuthContext.Provider value={{ user, loading, avatarUrl, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
