const BASE = '/api'

export interface User {
  id: number
  username: string
  role: 'admin' | 'operator' | 'viewer'
  created_at?: string
}

export interface Container {
  Id: string
  Names: string[]
  Image: string
  State: string
  Status: string
  Ports: Port[]
}

export interface Port {
  PublicPort?: number
  PrivatePort: number
  Type: string
}

export interface ContainerStat {
  id: string
  name: string
  status: string
  cpu_percent: number
  memory_usage: number
  memory_limit: number
  net_rx: number
  net_tx: number
  block_read: number
  block_write: number
}

export interface HostInfo {
  docker_version: string
  os: string
  kernel_version: string
  ncpu: number
  mem_total: number
  images: number
}

export interface StatsResponse {
  host: HostInfo
  containers: ContainerStat[]
}

export interface Image {
  Id: string
  RepoTags: string[]
  Size: number
  Created: number
}

export interface Stack {
  name: string
  services?: number
  service_count?: number
  created_at?: string
}

export interface HubResult {
  name?: string
  slug?: string
  description?: string
  short_description?: string
  is_official?: boolean
  star_count?: number
  pull_count?: number
}

export interface HubTag {
  name: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface ContainerDetail {
  Id: string
  Created: string
  Platform?: string
  Driver?: string
  Config: {
    Image: string
    Env?: string[]
  }
  HostConfig: {
    RestartPolicy?: { Name: string }
  }
  NetworkSettings: {
    Networks: Record<string, { IPAddress: string; Gateway: string }>
  }
  Mounts?: Array<{ Source: string; Destination: string; RW: boolean }>
}

function getToken(): string | null { return localStorage.getItem('token') }
function setToken(t: string): void { localStorage.setItem('token', t) }
function clearToken(): void { localStorage.removeItem('token') }

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { ...options, headers })
  if (res.status === 401) { clearToken(); window.location.href = '/login'; return undefined as unknown as T }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return null as unknown as T
  return res.json() as Promise<T>
}

export const api = {
  // Auth
  setup: (username: string, password: string) =>
    request<LoginResponse>('/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  // Containers
  containers: (all = true) => request<Container[]>(`/containers?all=${all}`),
  containerInspect: (id: string) => request<ContainerDetail>(`/containers/${id}`),
  containerStart: (id: string) => request<void>(`/containers/${id}/start`, { method: 'POST' }),
  containerStop: (id: string) => request<void>(`/containers/${id}/stop`, { method: 'POST' }),
  containerRestart: (id: string) => request<void>(`/containers/${id}/restart`, { method: 'POST' }),
  containerRemove: (id: string) => request<void>(`/containers/${id}`, { method: 'DELETE' }),
  containerLogs: (id: string) => `${BASE}/containers/${id}/logs`,

  // Images
  images: () => request<Image[]>('/images'),
  imagePull: (image: string) => request<void>('/images/pull', { method: 'POST', body: JSON.stringify({ image }) }),
  imageRemove: (id: string) => request<void>(`/images/${id}`, { method: 'DELETE' }),

  // Stacks
  stacks: () => request<Stack[]>('/stacks'),
  stackCreate: (name: string, compose_yaml: string) =>
    request<void>('/stacks', { method: 'POST', body: JSON.stringify({ name, compose_yaml }) }),
  stackRemove: (name: string) => request<void>(`/stacks/${name}`, { method: 'DELETE' }),
  stackCompose: (name: string) => request<{ compose_yaml?: string; content?: string }>(`/stacks/${name}/compose`),

  // Stats
  stats: () => request<StatsResponse>('/stats'),

  // Hub
  hubSearch: (q: string) => request<{ results: HubResult[] }>(`/hub/search?q=${encodeURIComponent(q)}`),
  hubTags: (image: string) => request<{ results: HubTag[] }>(`/hub/tags?image=${encodeURIComponent(image)}`),

  // Users
  users: () => request<User[]>('/users'),
  userCreate: (username: string, password: string, role: string) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  userDelete: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),

  setToken,
  getToken,
  clearToken,
}
