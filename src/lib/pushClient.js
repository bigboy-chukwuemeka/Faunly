// The browser side of notifications: asking permission and subscribing this device.

export function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  )
}

// Can this browser receive notifications at all? Returns { ok: true } or { ok: false, reason }.
export function pushSupport() {
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)

  if (!('serviceWorker' in navigator)) {
    return { ok: false, reason: 'This browser cannot run the background part that notifications need.' }
  }
  if (!('PushManager' in window) || !('Notification' in window)) {
    if (isIos && !isStandalone()) {
      return {
        ok: false,
        reason: 'On iPhone, add Faunly to your Home Screen first (Share, then Add to Home Screen), then open it from there.',
      }
    }
    return { ok: false, reason: 'This browser does not support notifications.' }
  }
  return { ok: true }
}

// Turns the server's public key into the form the browser wants.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

// The app's background service (sw.js). Waits a few seconds, then gives a clear error instead of hanging.
async function getRegistration() {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => {
      const why = window.__faunlySwError ? ` (${window.__faunlySwError})` : ''
      reject(new Error(`The app's background service did not start${why}. Reload the page and try again.`))
    }, 8000)
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export async function getCurrentSubscription() {
  const registration = await getRegistration()
  return registration.pushManager.getSubscription()
}

// Asks permission, then subscribes this device.
// IMPORTANT: call this straight from a button tap. The permission question has to be
// the first thing that happens, or iPhone refuses to show it.
// getPublicKey is a function that returns the server's public key (it runs after permission is given).
export async function subscribeThisDevice(getPublicKey) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.'
        : 'Notifications were not allowed, so nothing was turned on.'
    )
  }

  const publicKey = await getPublicKey()
  if (!publicKey) throw new Error('The server did not send a notification key.')

  const registration = await getRegistration()
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

// Stops notifications on this device. Returns the old address (so the server can forget it), or null.
export async function unsubscribeThisDevice() {
  const subscription = await getCurrentSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}