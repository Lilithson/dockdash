import React, { useContext } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { UserContext } from '../App'
import { api } from '../api'

const NAV = [
  { to: '/dashboard/stats',      icon: '📊', label: 'Dashboard' },
  { to: '/dashboard/containers', icon: '📦', label: 'Containers' },
  { to: '/dashboard/images',     icon: '🖼️',  label: 'Images' },
  { to: '/dashboard/stacks',     icon: '📚', label: 'Stacks' },
  { to: '/dashboard/store',      icon: '🏪', label: 'App Store' },
]

const ADMIN_NAV = [
  { to: '/dashboard/users', icon: '👥', label: 'Users' },
]

function pageTitleFromPath(pathname) {
  const map = {
    '/dashboard/stats':      'Dashboard',
    '/dashboard/containers': 'Containers',
    '/dashboard/images':     'Images',
    '/dashboard/stacks':     'Stacks',
    '/dashboard/store':      'App Store',
    '/dashboard/users':      'Users',
  }
  return map[pathname] || 'DockDash'
}

export default function Layout({ onLogout }) {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    api.logout().catch(() => {})
    api.clearToken()
    onLogout()
    navigate('/login', { replace: true })
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          🐳 DockDash
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          {isAdmin && ADMIN_NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-link w-full" onClick={handleLogout}>
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{pageTitleFromPath(location.pathname)}</span>
          {user && (
            <div className="topbar-user">
              <span>{user.username}</span>
              <span className={`badge badge-${user.role === 'admin' ? 'primary' : user.role === 'operator' ? 'info' : 'muted'}`}>
                {user.role}
              </span>
            </div>
          )}
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
