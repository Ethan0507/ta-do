import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Library } from './pages/Library'

function App() {
  const { session, loading } = useAuth()
  const [screen, setScreen] = useState<'home' | 'library'>('home')

  if (loading) return null
  if (!session) return <Login />

  return screen === 'home' ? (
    <Home session={session} onOpenLibrary={() => setScreen('library')} />
  ) : (
    <Library session={session} onBack={() => setScreen('home')} />
  )
}

export default App
