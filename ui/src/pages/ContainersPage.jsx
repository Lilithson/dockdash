import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'

const FILTERS = ['All', 'Running', 'Stopped', 'Exited']

function statusBadge(state) {
  if (!state) return <span className="badge badge-muted">unknown</span>
  const s = state.toLowerCase()
  if (s === 'running')    return <span className="badge badge-success">running</span>
  if (s === 'restarting') return <span className="badge badge-warning">restarting</span>
  if (s === 'paused')     return <span className="badge badge-info">paused</span>
  if (s === 'exited')     return <span className="badge badge-danger">exited</span>
  return <span className="badge badge-muted">{state}</span>
}

function fmtPorts(ports) {
  if (!ports || ports.length === 0) return '—'
  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
    .join(', ') || '—'
}

function fmtBytes(b) {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}

function CpuBar({ pct }) {
  if (pct == null) return <span className="text-muted">—</span>
  const cls = pct > 80 ? 'danger' : pct > 50 ? 'warning' : ''
  return (
    <div style={{ width: 90 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{pct.toFixed(1)}%</div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

function MemBar({ used, limit }) {
  if (used == null) return <span className="text-muted">—</span>
  const pct = limit > 0 ? (used / limit) * 100 : 0
  const cls = pct > 80 ? 'danger' : pct > 60 ? 'warning' : ''
  return (
    <div style={{ width: 110 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{fmtBytes(used)} / {fmtBytes(limit)}</div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

function LogsPanel({ containerId }) {
  const [logs, setLogs] = useState('Loading logs...')
  const boxRef = useRef(null)

  useEffect(() => {
    const token = api.getToken()
    const url = api.containerLogs(containerId) + '?tail=100'
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.text())
      .then(t => {
        // Strip Docker log multiplexing headers (8-byte header per line)
        const clean = t.replace(/[\x00-\x08][\x00]{3}[\x00-\xff]{4}/g, '')
        setLogs(clean || '(no logs)')
      })
      .catch(() => setLogs('Failed to load logs.'))
  }, [containerId])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [logs])

  return <div className="logs-box" ref={boxRef}>{logs}</div>
}

function InspectPanel({ container }) {
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.containerInspect(container.Id)
      .then(setDetail)
      .catch(e => setErr(e.message))
  }, [container.Id])

  if (err) return <div className="error-msg">{err}</div>
  if (!detail) return <div><span className="spinner" /></div>

  const cfg = detail.Config || {}
  const hc  = detail.HostConfig || {}
  const net = detail.NetworkSettings?.Networks || {}

  return (
    <div>
      <div className="detail-grid mb-4">
        <div className="detail-item"><label>ID</label><span className="font-mono">{detail.Id?.slice(0, 12)}</span></div>
        <div className="detail-item"><label>Created</label><span>{new Date(detail.Created).toLocaleString()}</span></div>
        <div className="detail-item"><label>Image</label><span className="font-mono">{cfg.Image}</span></div>
        <div className="detail-item"><label>Restart Policy</label><span>{hc.RestartPolicy?.Name || '—'}</span></div>
        <div className="detail-item"><label>Platform</label><span>{detail.Platform || '—'}</span></div>
        <div className="detail-item"><label>Driver</label><span>{detail.Driver || '—'}</span></div>
      </div>

      {cfg.Env && cfg.Env.length > 0 && (
        <>
          <h4 className="card-title mb-2">Environment Variables</h4>
          <div className="logs-box mb-4" style={{ maxHeight: 160 }}>{cfg.Env.join('\n')}</div>
        </>
      )}

      {detail.Mounts && detail.Mounts.length > 0 && (
        <>
          <h4 className="card-title mb-2">Mounts</h4>
          <div className="table-wrap mb-4">
            <table>
              <thead><tr><th>Source</th><th>Destination</th><th>Mode</th></tr></thead>
              <tbody>
                {detail.Mounts.map((m, i) => (
                  <tr key={i}>
                    <td className="td-mono">{m.Source}</td>
                    <td className="td-mono">{m.Destination}</td>
                    <td>{m.RW ? 'rw' : 'ro'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {Object.keys(net).length > 0 && (
        <>
          <h4 className="card-title mb-2">Networks</h4>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Network</th><th>IP Address</th><th>Gateway</th></tr></thead>
              <tbody>
                {Object.entries(net).map(([name, n]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="td-mono">{n.IPAddress || '—'}</td>
                    <td className="td-mono">{n.Gateway || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ContainerModal({ container, onClose, stats }) {
  const [tab, setTab] = useState('inspect')
  const cStats = stats[container.Id]

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2>📦 {(container.Names?.[0] || container.Id).replace(/^\//, '')}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ paddingTop: 0 }}>
          <div className="tabs" style={{ marginTop: 16 }}>
            <button className={`tab ${tab === 'inspect' ? 'active' : ''}`} onClick={() => setTab('inspect')}>Inspect</button>
            <button className={`tab ${tab === 'logs'    ? 'active' : ''}`} onClick={() => setTab('logs')}>Logs</button>
            {cStats && <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Stats</button>}
          </div>
          {tab === 'inspect' && <InspectPanel container={container} />}
          {tab === 'logs'    && <LogsPanel containerId={container.Id} />}
          {tab === 'stats'   && cStats && (
            <div className="detail-grid">
              <div className="detail-item"><label>CPU %</label><CpuBar pct={cStats.cpu_percent} /></div>
              <div className="detail-item"><label>Memory</label><MemBar used={cStats.memory_usage} limit={cStats.memory_limit} /></div>
              <div className="detail-item"><label>Network I/O</label><span>{fmtBytes(cStats.net_rx)} / {fmtBytes(cStats.net_tx)}</span></div>
              <div className="detail-item"><label>Block I/O</label><span>{fmtBytes(cStats.block_read)} / {fmtBytes(cStats.block_write)}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContainersPage() {
  const [containers, setContainers] = useState([])
  const [stats,      setStats]      = useState({})
  const [filter,     setFilter]     = useState('All')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [selected,   setSelected]   = useState(null)
  const [actionId,   setActionId]   = useState(null)
  const [confirmRm,  setConfirmRm]  = useState(null)

  const fetchContainers = useCallback(async () => {
    try {
      const data = await api.containers(true)
      setContainers(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.stats()
      const map = {}
      if (data?.containers) data.containers.forEach(c => { map[c.id] = c })
      setStats(map)
    } catch {}
  }, [])

  useEffect(() => {
    fetchContainers()
    fetchStats()
    const t = setInterval(() => { fetchContainers(); fetchStats() }, 5000)
    return () => clearInterval(t)
  }, [fetchContainers, fetchStats])

  async function doAction(id, action) {
    setActionId(id)
    try {
      if (action === 'start')   await api.containerStart(id)
      if (action === 'stop')    await api.containerStop(id)
      if (action === 'restart') await api.containerRestart(id)
      if (action === 'remove')  await api.containerRemove(id)
      await fetchContainers()
    } catch (e) {
      setError(e.message)
    } finally {
      setActionId(null)
    }
  }

  const filtered = containers.filter(c => {
    const s = (c.State || '').toLowerCase()
    if (filter === 'Running') return s === 'running'
    if (filter === 'Stopped') return s === 'created' || s === 'paused'
    if (filter === 'Exited')  return s === 'exited'
    return true
  })

  if (loading) return <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div>
      <div className="page-header">
        <h1>Containers</h1>
        <button className="btn btn-ghost btn-sm" onClick={fetchContainers}>↻ Refresh</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="tabs">
        {FILTERS.map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Image</th>
              <th>Status</th>
              <th>Ports</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No containers</td></tr>
            )}
            {filtered.map(c => {
              const name = (c.Names?.[0] || c.Id).replace(/^\//, '')
              const cSt  = stats[c.Id]
              const busy = actionId === c.Id
              const isRunning = c.State === 'running'
              return (
                <tr key={c.Id}>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontWeight: 600, background: 'none', border: 'none', color: 'var(--primary-h)', padding: '2px 0', cursor: 'pointer' }}
                      onClick={() => setSelected(c)}
                    >
                      {name}
                    </button>
                  </td>
                  <td className="td-mono">{c.Image}</td>
                  <td>{statusBadge(c.State)}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{fmtPorts(c.Ports)}</td>
                  <td><CpuBar pct={cSt?.cpu_percent} /></td>
                  <td><MemBar used={cSt?.memory_usage} limit={cSt?.memory_limit} /></td>
                  <td>
                    <div className="btn-group">
                      {!isRunning && (
                        <button className="btn btn-success btn-sm" disabled={busy} onClick={() => doAction(c.Id, 'start')}>▶</button>
                      )}
                      {isRunning && (
                        <button className="btn btn-warning btn-sm" disabled={busy} onClick={() => doAction(c.Id, 'stop')}>■</button>
                      )}
                      {isRunning && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => doAction(c.Id, 'restart')}>↻</button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => setConfirmRm(c)}
                      >🗑</button>
                      {busy && <span className="spinner" />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <ContainerModal
          container={selected}
          stats={stats}
          onClose={() => setSelected(null)}
        />
      )}

      {confirmRm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmRm(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Remove Container</h2>
              <button className="btn-close" onClick={() => setConfirmRm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Remove container <strong>{(confirmRm.Names?.[0] || confirmRm.Id).replace(/^\//, '')}</strong>?</p>
              <p className="text-muted mt-2" style={{ fontSize: 12 }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmRm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { doAction(confirmRm.Id, 'remove'); setConfirmRm(null) }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
