import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { CaptureSetup } from './components/CaptureSetup'
import { fetchOnboardedAt, syncTimezone } from './lib/profile'
import { generateTodaysTasks } from './lib/habits'
import { fetchTimezoneSetting } from './lib/settings'
import { setAppTimezone } from './lib/day'
import type { Entry } from './types'

function App() {
  const { session, loading } = useAuth()
  const theme = useTheme(session?.user.id)
  const [screen, setScreen] = useState<'home' | 'library'>('home')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [templateToOpen, setTemplateToOpen] = useState<Entry | null>(null)
  // Bumped once today's repeating tasks exist, so Home refetches.
  const [dayRefreshKey, setDayRefreshKey] = useState(0)

  // Settle the account's timezone, then make sure today's repeating tasks exist.
  const refreshDay = useCallback(async (userId: string) => {
    const { timezone } = await fetchTimezoneSetting(userId)
    setAppTimezone(timezone)
    await generateTodaysTasks()
    setDayRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!session) return
    syncTimezone(session.user.id)
      .then(() => refreshDay(session.user.id))
      .catch(() => {})
  }, [session, refreshDay])

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
        <Home
          session={session}
          onOpenLibrary={() => setScreen('library')}
          onOpenTemplate={(template) => {
            setTemplateToOpen(template)
            setScreen('library')
          }}
          refreshKey={dayRefreshKey}
          onTimezoneChanged={() => refreshDay(session.user.id).catch(() => {})}
          theme={theme}
        />
      ) : (
        <Library
          session={session}
          initialEntry={templateToOpen}
          onBack={() => {
            setTemplateToOpen(null)
            setScreen('home')
          }}
        />
      )}
      {showOnboarding && <CaptureSetup userId={session.user.id} onClose={() => setShowOnboarding(false)} />}
    </>
  )
}

export default App
