const BASE = '/api'

function getToken() { return localStorage.getItem('token') }
function setToken(t) { localStorage.setItem('token', t) }
function clearToken() { localStorage.removeItem('token') }

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { ...options, headers })
  if (res.status === 401) { clearToken(); window.location.href = '/login'; return }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  setup: (username, password) => request('/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Containers
  containers: (all = true) => request(`/containers?all=${all}`),
  containerInspect: (id) => request(`/containers/${id}`),
  containerStart: (id) => request(`/containers/${id}/start`, { method: 'POST' }),
  containerStop: (id) => request(`/containers/${id}/stop`, { method: 'POST' }),
  containerRestart: (id) => request(`/containers/${id}/restart`, { method: 'POST' }),
  containerRemove: (id) => request(`/containers/${id}`, { method: 'DELETE' }),
  containerLogs: (id) => `${BASE}/containers/${id}/logs`,

  // Images
  images: () => request('/images'),
  imagePull: (image) => request('/images/pull', { method: 'POST', body: JSON.stringify({ image }) }),
  imageRemove: (id) => request(`/images/${id}`, { method: 'DELETE' }),

  // Stacks
  stacks: () => request('/stacks'),
  stackCreate: (name, compose_yaml) => request('/stacks', { method: 'POST', body: JSON.stringify({ name, compose_yaml }) }),
  stackRemove: (name) => request(`/stacks/${name}`, { method: 'DELETE' }),
  stackCompose: (name) => request(`/stacks/${name}/compose`),

  // Stats
  stats: () => request('/stats'),

  // Hub
  hubSearch: (q) => request(`/hub/search?q=${encodeURIComponent(q)}`),
  hubTags: (image) => request(`/hub/tags?image=${encodeURIComponent(image)}`),

  // Users
  users: () => request('/users'),
  userCreate: (username, password, role) => request('/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  userDelete: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  setToken,
  getToken,
  clearToken,
}
