import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function DeployModal({ onClose, onDeployed }) {
  const [name,    setName]    = useState('')
  const [yaml,    setYaml]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDeploy(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Stack name is required.'); return }
    if (!yaml.trim()) { setError('Compose YAML is required.'); return }
    setError(''); setLoading(true)
    try {
      await api.stackCreate(name.trim(), yaml.trim())
      onDeployed()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>Deploy Stack</h2>
          <button className="btn-close" onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Stack Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. myapp"
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Compose YAML</label>
            <textarea
              value={yaml}
              onChange={e => setYaml(e.target.value)}
              placeholder={`version: '3'\nservices:\n  web:\n    image: nginx:latest\n    ports:\n      - "80:80"`}
              style={{ minHeight: 240, fontFamily: 'monospace', fontSize: 12 }}
              disabled={loading}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDeploy} disabled={loading}>
            {loading ? <><span className="spinner" /> Deploying…</> : '🚀 Deploy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ComposeModal({ stackName, onClose }) {
  const [yaml,    setYaml]    = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.stackCompose(stackName)
      .then(data => setYaml(data?.compose_yaml || data?.content || JSON.stringify(data, null, 2)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [stackName])

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>📚 {stackName} — Compose YAML</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error   && <div className="error-msg">{error}</div>}
          {loading && <div><span className="spinner" /></div>}
          {!loading && !error && (
            <div className="logs-box" style={{ maxHeight: 480 }}>{yaml}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StacksPage() {
  const [stacks,    setStacks]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showDeploy, setShowDeploy] = useState(false)
  const [viewStack,  setViewStack]  = useState(null)
  const [confirmRm,  setConfirmRm]  = useState(null)
  const [removing,   setRemoving]   = useState(null)

  const fetchStacks = useCallback(async () => {
    try {
      const data = await api.stacks()
      setStacks(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStacks() }, [fetchStacks])

  async function handleRemove(name) {
    setRemoving(name)
    try {
      await api.stackRemove(name)
      await fetchStacks()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(null)
    }
  }

  if (loading) return <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div>
      <div className="page-header">
        <h1>Stacks</h1>
        <div className="btn-group">
          <button className="btn btn-ghost btn-sm" onClick={fetchStacks}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowDeploy(true)}>🚀 Deploy Stack</button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Services</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stacks.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No stacks deployed</td></tr>
            )}
            {stacks.map(s => (
              <tr key={s.name}>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontWeight: 600, background: 'none', border: 'none', color: 'var(--primary-h)', padding: '2px 0', cursor: 'pointer' }}
                    onClick={() => setViewStack(s.name)}
                  >
                    {s.name}
                  </button>
                </td>
                <td>{s.services ?? s.service_count ?? '—'}</td>
                <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={removing === s.name}
                    onClick={() => setConfirmRm(s.name)}
                  >
                    {removing === s.name ? <span className="spinner" /> : '🗑 Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDeploy && (
        <DeployModal
          onClose={() => setShowDeploy(false)}
          onDeployed={() => { fetchStacks(); setShowDeploy(false) }}
        />
      )}

      {viewStack && (
        <ComposeModal stackName={viewStack} onClose={() => setViewStack(null)} />
      )}

      {confirmRm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmRm(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Remove Stack</h2>
              <button className="btn-close" onClick={() => setConfirmRm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Remove stack <strong>{confirmRm}</strong> and all its containers?</p>
              <p className="text-muted mt-2" style={{ fontSize: 12 }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmRm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { handleRemove(confirmRm); setConfirmRm(null) }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
