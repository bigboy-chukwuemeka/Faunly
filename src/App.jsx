import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Capture from './pages/Capture'
import Chat from './pages/Chat'
import MyAnimals from './pages/MyAnimals'
import History from './pages/History'
import ConversationView from './pages/ConversationView'
import Profile from './pages/Profile'
import AddAnimal from './pages/AddAnimal'
import AnimalProfile from './pages/AnimalProfile'
import HealthAssistant from './pages/HealthAssistant'
import AddHealthRecord from './pages/AddHealthRecord'
import Auth from './pages/Auth'
import Reminders from './pages/Reminders'
import AddReminder from './pages/AddReminder'
import ReminderDetail from './pages/ReminderDetail'
import { useTheme } from './lib/useTheme'
import { AuthProvider } from './lib/AuthContext'
import { getGuestSessionId } from './lib/guestSession'

const FUNCTION_URL = 'https://wlgjtfqgmfgbhmjmsadr.supabase.co/functions/v1/super-service'

function warmUpEdgeFunction() {
  try {
    fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'ping', guest_session_id: getGuestSessionId() }),
    }).catch(() => {
      // silent - this is just a warm-up, failures here don't matter
    })
  } catch {
    // silent
  }
}

function App() {
  useTheme()

  useEffect(() => {
    warmUpEdgeFunction()
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/identify" element={<Capture />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/my-animals" element={<MyAnimals />} />
          <Route path="/add-animal" element={<AddAnimal />} />
          <Route path="/animals/:id" element={<AnimalProfile />} />
          <Route path="/animals/:id/health-assistant" element={<HealthAssistant />} />
          <Route path="/animals/:id/add-record" element={<AddHealthRecord />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<ConversationView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/reminders/add" element={<AddReminder />} />
          <Route path="/reminders/:id" element={<ReminderDetail />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
