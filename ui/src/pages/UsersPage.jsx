import React, { useState, useEffect, useCallback, useContext } from 'react'
import { api } from '../api'
import { UserContext } from '../App'

function AddUserModal({ onClose, onAdded }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('viewer')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) { setError('Username and password are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError(''); setLoading(true)
    try {
      await api.userCreate(username, password, role)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Add User</h2>
          <button className="btn-close" onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              disabled={loading}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
              <option value="viewer">Viewer — read-only access</option>
              <option value="operator">Operator — manage containers/images</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" /> Creating…</> : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

function roleBadge(role) {
  if (role === 'admin')    return <span className="badge badge-primary">admin</span>
  if (role === 'operator') return <span className="badge badge-info">operator</span>
  return <span className="badge badge-muted">viewer</span>
}

export default function UsersPage() {
  const { user: me }            = useContext(UserContext)
  const [users,     setUsers]   = useState([])
  const [loading,   setLoading] = useState(true)
  const [error,     setError]   = useState('')
  const [showAdd,   setShowAdd] = useState(false)
  const [confirmRm, setConfirmRm] = useState(null)
  const [deleting,  setDeleting]  = useState(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.users()
      setUsers(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleDelete(u) {
    setDeleting(u.id)
    try {
      await api.userDelete(u.id)
      await fetchUsers()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>👤 Add User</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No users</td></tr>
            )}
            {users.map(u => {
              const isMe = me?.id === u.id || me?.username === u.username
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>
                    {u.username}
                    {isMe && <span className="badge badge-muted" style={{ marginLeft: 8 }}>you</span>}
                  </td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={isMe || deleting === u.id}
                      title={isMe ? "You can't delete yourself" : `Delete ${u.username}`}
                      onClick={() => setConfirmRm(u)}
                    >
                      {deleting === u.id ? <span className="spinner" /> : '🗑 Delete'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { fetchUsers(); setShowAdd(false) }}
        />
      )}

      {confirmRm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmRm(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="btn-close" onClick={() => setConfirmRm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete user <strong>{confirmRm.username}</strong>?</p>
              <p className="text-muted mt-2" style={{ fontSize: 12 }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmRm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { handleDelete(confirmRm); setConfirmRm(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
