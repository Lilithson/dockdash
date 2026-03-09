import React, { useEffect, useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api, User } from './api'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import ContainersPage from './pages/ContainersPage'
import ImagesPage from './pages/ImagesPage'
import StacksPage from './pages/StacksPage'
import StatsPage from './pages/StatsPage'
import AppStorePage from './pages/AppStorePage'
import UsersPage from './pages/UsersPage'

interface UserContextType {
  user: User | null
  setUser: (user: User | null) => void
}

export const UserContext = createContext<UserContextType>({ user: null, setUser: () => {} })

export function useUserContext(): UserContextType {
  return useContext(UserContext)
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    const token = api.getToken()
    if (!token) { setChecked(true); return }
    api.me()
      .then(u => { setUser(u); setChecked(true) })
      .catch((err: Error) => {
        if (err.message && err.message.toLowerCase().includes('setup')) {
          setNeedsSetup(true)
        }
        setChecked(true)
      })
  }, [])

  // Check if setup is needed (no token + first run)
  useEffect(() => {
    if (!api.getToken()) {
      fetch('/api/auth/me')
        .then(r => {
          if (r.status === 404) setNeedsSetup(true)
        })
        .catch(() => {})
    }
  }, [])

  if (!checked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={u => setUser(u)} />} />
          <Route path="/setup" element={<SetupPage onSetup={u => setUser(u)} />} />
          <Route path="/" element={
            needsSetup
              ? <Navigate to="/setup" replace />
              : <Navigate to="/dashboard/stats" replace />
          } />
          <Route path="/dashboard" element={
            <RequireAuth>
              <Layout onLogout={() => { api.clearToken(); setUser(null) }} />
            </RequireAuth>
          }>
            <Route index element={<Navigate to="stats" replace />} />
            <Route path="stats"      element={<StatsPage />} />
            <Route path="containers" element={<ContainersPage />} />
            <Route path="images"     element={<ImagesPage />} />
            <Route path="stacks"     element={<StacksPage />} />
            <Route path="store"      element={<AppStorePage />} />
            <Route path="users"      element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  )
}
