import { supabase } from './supabaseClient'

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null)
  })
}

export async function getAuthHeader() {
  const session = await getCurrentSession()
  return session ? `Bearer ${session.access_token}` : 'Bearer sb_publishable_BC8M9p84K687LngR8FEo1A_JpKoBeK6'
}
