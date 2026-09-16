import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { CaptureSetup } from './components/CaptureSetup'
import { fetchOnboardedAt } from './lib/profile'

function App() {
  const { session, loading } = useAuth()
  const theme = useTheme(session?.user.id)
  const [screen, setScreen] = useState<'home' | 'library'>('home')
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!session) return
    fetchOnboardedAt(session.user.id)
      .then((onboardedAt) => {
        if (!onboardedAt) setShowOnboarding(true)
      })
      .catch(() => {})
  }, [session])

  if (loading) return null
  if (!session) return <Login />

  return (
    <>
      {screen === 'home' ? (
        <Home session={session} onOpenLibrary={() => setScreen('library')} theme={theme} />
      ) : (
        <Library session={session} onBack={() => setScreen('home')} />
      )}
      {showOnboarding && <CaptureSetup userId={session.user.id} onClose={() => setShowOnboarding(false)} />}
    </>
  )
}

export default App
