import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function fmtBytes(b) {
  if (b == null) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}

function UsageBar({ pct }) {
  const cls = pct > 80 ? 'danger' : pct > 60 ? 'warning' : ''
  return (
    <div style={{ width: 120 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{pct.toFixed(1)}%</div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="card-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="text-muted mt-1" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

export default function StatsPage() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.stats()
      setStats(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 5000)
    return () => clearInterval(t)
  }, [fetchStats])

  if (loading) return <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>

  if (error) return <div className="error-msg">{error}</div>

  const host = stats?.host || {}
  const containers = stats?.containers || []
  const running = containers.filter(c => c.status === 'running').length
  const stopped = containers.length - running

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn btn-ghost btn-sm" onClick={fetchStats}>↻ Refresh</button>
      </div>

      {/* Host info cards */}
      <div className="cards-grid">
        <StatCard label="Docker Version"  value={host.docker_version || '—'} />
        <StatCard label="OS"              value={host.os || '—'} sub={host.kernel_version} />
        <StatCard label="Running"         value={running} color="var(--success)" sub={`${stopped} stopped`} />
        <StatCard label="Total Images"    value={host.images ?? '—'} />
        <StatCard label="CPUs"            value={host.ncpu ?? '—'} />
        <StatCard label="Total Memory"    value={fmtBytes(host.mem_total)} />
      </div>

      {/* Per-container stats */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Container Stats</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Net I/O (rx/tx)</th>
              <th>Block I/O (r/w)</th>
            </tr>
          </thead>
          <tbody>
            {containers.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No containers</td></tr>
            )}
            {containers.map(c => {
              const cpuPct = c.cpu_percent ?? 0
              const memPct = c.memory_limit > 0 ? (c.memory_usage / c.memory_limit) * 100 : 0
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>
                    {c.status === 'running'
                      ? <span className="badge badge-success">running</span>
                      : <span className="badge badge-muted">{c.status}</span>
                    }
                  </td>
                  <td><UsageBar pct={cpuPct} /></td>
                  <td>
                    <div style={{ width: 160 }}>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        {fmtBytes(c.memory_usage)} / {fmtBytes(c.memory_limit)}
                      </div>
                      <div className="progress-bar">
                        <div
                          className={`progress-fill ${memPct > 80 ? 'danger' : memPct > 60 ? 'warning' : ''}`}
                          style={{ width: `${Math.min(memPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="td-mono">{fmtBytes(c.net_rx)} / {fmtBytes(c.net_tx)}</td>
                  <td className="td-mono">{fmtBytes(c.block_read)} / {fmtBytes(c.block_write)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
