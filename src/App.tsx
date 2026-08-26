import { useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Home } from './pages/Home'

function App() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Login />
  return <Home session={session} />
}

export default App
