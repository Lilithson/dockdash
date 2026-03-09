import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function fmtSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString()
}

function PullModal({ onClose, onPulled }) {
  const [image,   setImage]   = useState('')
  const [status,  setStatus]  = useState('')
  const [pulling, setPulling] = useState(false)
  const [error,   setError]   = useState('')

  async function handlePull(e) {
    e.preventDefault()
    if (!image.trim()) { setError('Enter an image name.'); return }
    setError(''); setPulling(true); setStatus('Pulling...')
    try {
      await api.imagePull(image.trim())
      setStatus('Pull complete!')
      onPulled()
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setPulling(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !pulling && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Pull Image</h2>
          <button className="btn-close" onClick={onClose} disabled={pulling}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}
          {status && !error && (
            <div className="info-msg" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pulling && <span className="spinner" />}
              {status}
            </div>
          )}
          <form onSubmit={handlePull}>
            <div className="form-group">
              <label>Image Name</label>
              <input
                type="text"
                value={image}
                onChange={e => setImage(e.target.value)}
                placeholder="e.g. nginx:latest or ubuntu:22.04"
                autoFocus
                disabled={pulling}
              />
            </div>
          </form>
          <p className="text-muted" style={{ fontSize: 12 }}>
            Enter the full image reference including tag (defaults to :latest if omitted).
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={pulling}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePull} disabled={pulling || !image.trim()}>
            {pulling ? <><span className="spinner" /> Pulling…</> : 'Pull Image'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ImagesPage() {
  const [images,    setImages]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showPull,  setShowPull]  = useState(false)
  const [confirmRm, setConfirmRm] = useState(null)
  const [removing,  setRemoving]  = useState(null)

  const fetchImages = useCallback(async () => {
    try {
      const data = await api.images()
      setImages(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchImages() }, [fetchImages])

  async function handleRemove(img) {
    setRemoving(img.Id)
    try {
      await api.imageRemove(img.Id)
      await fetchImages()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(null)
    }
  }

  function fmtRepo(img) {
    if (!img.RepoTags || img.RepoTags.length === 0) return '<none>'
    return img.RepoTags[0]
  }

  if (loading) return <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div>
      <div className="page-header">
        <h1>Images</h1>
        <div className="btn-group">
          <button className="btn btn-ghost btn-sm" onClick={fetchImages}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowPull(true)}>⬇ Pull Image</button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Repository:Tag</th>
              <th>ID</th>
              <th>Size</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No images</td></tr>
            )}
            {images.map(img => (
              <tr key={img.Id}>
                <td className="td-mono">{fmtRepo(img)}</td>
                <td className="td-mono">{img.Id?.replace('sha256:', '').slice(0, 12)}</td>
                <td>{fmtSize(img.Size)}</td>
                <td>{fmtDate(img.Created)}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={removing === img.Id}
                    onClick={() => setConfirmRm(img)}
                  >
                    {removing === img.Id ? <span className="spinner" /> : '🗑 Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPull && (
        <PullModal
          onClose={() => setShowPull(false)}
          onPulled={() => { fetchImages(); setShowPull(false) }}
        />
      )}

      {confirmRm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmRm(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Remove Image</h2>
              <button className="btn-close" onClick={() => setConfirmRm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Remove image <strong className="td-mono">{fmtRepo(confirmRm)}</strong>?</p>
              <p className="text-muted mt-2" style={{ fontSize: 12 }}>This will fail if any containers use this image.</p>
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
