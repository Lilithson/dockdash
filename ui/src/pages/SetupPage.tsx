import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, User } from '../api'

interface SetupPageProps {
  onSetup: (user: User) => void
}

export default function SetupPage({ onSetup }: SetupPageProps) {
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [error,    setError]      = useState('')
  const [loading,  setLoading]    = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password || !confirm) { setError('Please fill in all fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return }
    setError('')
    setLoading(true)
    try {
      const data = await api.setup(username, password)
      api.setToken(data.token)
      onSetup(data.user)
      navigate('/dashboard/stats', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-logo">🐳 DockDash</div>
        <p className="auth-subtitle">Welcome — let's create your admin account</p>

        <div className="info-msg">
          This is a one-time setup. You'll use these credentials to manage DockDash.
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Admin Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? <span className="spinner" /> : 'Create Admin Account'}
          </button>
        </form>

        <p className="text-muted mt-4" style={{ textAlign: 'center', fontSize: 12 }}>
          Already set up? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  )
}
