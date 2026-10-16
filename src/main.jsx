import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Let the app be installed to the Home Screen (and, later, receive notifications).
// If this fails the app still works, and the reason is kept in window.__faunlySwError
// so a later screen can show it. It is not thrown, because the debug screen in index.html
// would replace the whole app with an error page.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      window.__faunlySwError = (err && err.message) || String(err)
      console.error('Service worker registration failed:', err)
    })
  })
}
