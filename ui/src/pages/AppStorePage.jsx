import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const TEMPLATES = [
  { name: 'Nginx',       image: 'nginx:latest',       desc: 'High-performance web server and reverse proxy.',     icon: '🌐', ports: [{ host: '80', container: '80' }] },
  { name: 'PostgreSQL',  image: 'postgres:16',         desc: 'Advanced open-source relational database.',          icon: '🐘', ports: [{ host: '5432', container: '5432' }], env: [{ k: 'POSTGRES_PASSWORD', v: 'changeme' }] },
  { name: 'Redis',       image: 'redis:7-alpine',      desc: 'In-memory data structure store.',                    icon: '🔴', ports: [{ host: '6379', container: '6379' }] },
  { name: 'MySQL',       image: 'mysql:8',             desc: 'Popular open-source relational database.',           icon: '🐬', ports: [{ host: '3306', container: '3306' }], env: [{ k: 'MYSQL_ROOT_PASSWORD', v: 'changeme' }] },
  { name: 'Grafana',     image: 'grafana/grafana',     desc: 'Analytics and monitoring platform.',                 icon: '📈', ports: [{ host: '3000', container: '3000' }] },
  { name: 'Prometheus',  image: 'prom/prometheus',     desc: 'Systems monitoring and alerting toolkit.',           icon: '🔥', ports: [{ host: '9090', container: '9090' }] },
  { name: 'MinIO',       image: 'minio/minio',         desc: 'High-performance S3-compatible object storage.',     icon: '🪣', ports: [{ host: '9000', container: '9000' }] },
  { name: 'Portainer',   image: 'portainer/portainer-ce:latest', desc: 'Docker management UI.',                  icon: '🐋', ports: [{ host: '9443', container: '9443' }] },
  { name: 'WordPress',   image: 'wordpress:latest',    desc: 'Popular CMS platform.',                              icon: '📝', ports: [{ host: '8080', container: '80' }] },
  { name: 'Traefik',     image: 'traefik:v3.0',        desc: 'Cloud-native application proxy.',                   icon: '🔀', ports: [{ host: '80', container: '80' }, { host: '8080', container: '8080' }] },
  { name: 'Elasticsearch', image: 'elasticsearch:8.12.0', desc: 'Distributed search and analytics engine.',      icon: '🔍', ports: [{ host: '9200', container: '9200' }], env: [{ k: 'discovery.type', v: 'single-node' }] },
  { name: 'RabbitMQ',    image: 'rabbitmq:3-management', desc: 'Message broker with management UI.',              icon: '🐇', ports: [{ host: '5672', container: '5672' }, { host: '15672', container: '15672' }] },
]

const RESTART_POLICIES = ['no', 'always', 'unless-stopped', 'on-failure']

function KvRows({ rows, setRows, kPlaceholder = 'key', vPlaceholder = 'value' }) {
  function update(i, field, val) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div className="kv-row" key={i}>
          <input type="text" value={r.k} onChange={e => update(i, 'k', e.target.value)} placeholder={kPlaceholder} />
          <input type="text" value={r.v} onChange={e => update(i, 'v', e.target.value)} placeholder={vPlaceholder} />
          <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setRows([...rows, { k: '', v: '' }])}>+ Add</button>
    </div>
  )
}

function DeployWizard({ image: initImage, onClose }) {
  const [image,    setImage]    = useState(initImage || '')
  const [tag,      setTag]      = useState('latest')
  const [tags,     setTags]     = useState([])
  const [name,     setName]     = useState('')
  const [ports,    setPorts]    = useState([{ k: '', v: '' }])
  const [envs,     setEnvs]     = useState([{ k: '', v: '' }])
  const [vols,     setVols]     = useState([{ k: '', v: '' }])
  const [restart,  setRestart]  = useState('unless-stopped')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // Load tags for the image
  useEffect(() => {
    if (!image.trim()) return
    const base = image.split(':')[0]
    api.hubTags(base)
      .then(data => {
        const list = data?.results?.map(t => t.name) || []
        setTags(list)
      })
      .catch(() => {})
  }, [image])

  async function handleDeploy() {
    if (!image.trim()) { setError('Image is required.'); return }
    setError(''); setLoading(true)
    const fullImage = `${image.split(':')[0]}:${tag}`
    try {
      // Pull image
      setSuccess('Pulling image…')
      await api.imagePull(fullImage)
      setSuccess('Image pulled! Creating container…')

      // Build request
      const portBindings = {}
      ports.filter(p => p.k && p.v).forEach(p => {
        portBindings[`${p.v}/tcp`] = [{ HostPort: p.k }]
      })
      const envList = envs.filter(e => e.k).map(e => `${e.k}=${e.v}`)
      const binds   = vols.filter(v => v.k && v.v).map(v => `${v.k}:${v.v}`)

      const body = {
        image: fullImage,
        name: name.trim() || undefined,
        port_bindings: portBindings,
        env: envList,
        binds,
        restart_policy: restart,
      }
      await fetch('/api/containers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : {}),
        },
        body: JSON.stringify(body),
      })
      setSuccess('Container deployed successfully!')
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e.message || 'Deploy failed')
      setSuccess('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '95vh' }}>
        <div className="modal-header">
          <h2>🚀 Deploy Container</h2>
          <button className="btn-close" onClick={onClose} disabled={loading}>✕</button>
        </div>
        <div className="modal-body">
          {error   && <div className="error-msg">{error}</div>}
          {success && <div className="info-msg">{success}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Image</label>
              <input type="text" value={image} onChange={e => setImage(e.target.value)} placeholder="nginx" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Tag</label>
              {tags.length > 0 ? (
                <select value={tag} onChange={e => setTag(e.target.value)}>
                  {tags.slice(0, 50).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="latest" />
              )}
            </div>
          </div>

          <div className="form-group mt-3">
            <label>Container Name (optional)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="my-container" />
          </div>

          <div className="form-group">
            <label>Restart Policy</label>
            <select value={restart} onChange={e => setRestart(e.target.value)}>
              {RESTART_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Port Mappings (host : container)</label>
            <KvRows rows={ports} setRows={setPorts} kPlaceholder="host port" vPlaceholder="container port" />
          </div>

          <div className="form-group">
            <label>Environment Variables</label>
            <KvRows rows={envs} setRows={setEnvs} kPlaceholder="KEY" vPlaceholder="value" />
          </div>

          <div className="form-group">
            <label>Volume Mounts (host : container)</label>
            <KvRows rows={vols} setRows={setVols} kPlaceholder="/host/path" vPlaceholder="/container/path" />
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

function HubTab() {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [deploy,  setDeploy]  = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError('')
    try {
      const data = await api.hubSearch(query.trim())
      setResults(data?.results || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Docker Hub…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : '🔍 Search'}
        </button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {results.length === 0 && !loading && (
        <div className="empty-state">Search Docker Hub for images to deploy</div>
      )}

      <div className="store-grid">
        {results.map(r => (
          <div key={r.name || r.slug} className="store-card">
            <div className="store-card-title">
              {r.is_official && <span className="badge badge-info" style={{ fontSize: 10 }}>Official</span>}
              {r.name || r.slug}
            </div>
            <p className="store-card-desc">{r.description || r.short_description || 'No description available.'}</p>
            <div className="store-card-meta">
              {r.star_count != null && <span>⭐ {r.star_count.toLocaleString()}</span>}
              {r.pull_count != null && <span>⬇ {r.pull_count.toLocaleString()}</span>}
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setDeploy(r.name || r.slug)}
            >
              🚀 Deploy
            </button>
          </div>
        ))}
      </div>

      {deploy && <DeployWizard image={deploy} onClose={() => setDeploy(null)} />}
    </div>
  )
}

function TemplatesTab() {
  const [deploy, setDeploy] = useState(null)

  return (
    <div>
      <div className="store-grid">
        {TEMPLATES.map(t => (
          <div key={t.name} className="store-card">
            <div className="store-card-title">
              <span>{t.icon}</span>
              <span>{t.name}</span>
            </div>
            <p className="store-card-desc">{t.desc}</p>
            <div className="store-card-meta">
              <span className="td-mono">{t.image}</span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setDeploy(t)}
            >
              🚀 Quick Deploy
            </button>
          </div>
        ))}
      </div>

      {deploy && (
        <DeployWizard
          image={deploy.image}
          onClose={() => setDeploy(null)}
        />
      )}
    </div>
  )
}

export default function AppStorePage() {
  const [tab, setTab] = useState('templates')

  return (
    <div>
      <div className="page-header">
        <h1>App Store</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>📋 Templates</button>
        <button className={`tab ${tab === 'hub'       ? 'active' : ''}`} onClick={() => setTab('hub')}>🐳 Docker Hub</button>
      </div>

      {tab === 'templates' && <TemplatesTab />}
      {tab === 'hub'       && <HubTab />}
    </div>
  )
}
