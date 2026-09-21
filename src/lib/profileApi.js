import { supabase } from './supabaseClient'

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('id', userId)

  if (updateError) return { error: updateError.message }

  const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, 3600)
  return { avatarUrl: signed?.signedUrl || null }
}

export async function getProfileAvatar(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.avatar_url) return { avatarUrl: null }

  const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(data.avatar_url, 3600)
  return { avatarUrl: signed?.signedUrl || null }
}
