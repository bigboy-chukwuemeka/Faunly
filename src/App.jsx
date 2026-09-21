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
import { useTheme } from './lib/useTheme'
import { AuthProvider } from './lib/AuthContext'

function App() {
  useTheme()

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
