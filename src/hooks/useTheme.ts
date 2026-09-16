import { useCallback, useEffect, useState } from 'react'
import { fetchThemePreference, updateThemePreference } from '../lib/settings'
import type { ThemePreference } from '../types'

const STORAGE_KEY = 'ta-do-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'auto' && systemPrefersDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function useTheme(userId: string | undefined) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'auto',
  )

  useEffect(() => {
    applyTheme(preference)
  }, [preference])

  useEffect(() => {
    if (preference !== 'auto') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    if (!userId) return
    fetchThemePreference(userId)
      .then((pref) => {
        setPreferenceState(pref)
        localStorage.setItem(STORAGE_KEY, pref)
      })
      .catch(() => {})
  }, [userId])

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next)
      localStorage.setItem(STORAGE_KEY, next)
      if (userId) updateThemePreference(userId, next).catch(() => {})
    },
    [userId],
  )

  return { preference, setPreference }
}
