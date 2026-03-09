import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useUserContext } from '../App'
import { api } from '../api'

interface NavItem {
  to: string
  icon: string
  label: string
}

const NAV: NavItem[] = [
  { to: '/dashboard/stats',      icon: '📊', label: 'Dashboard' },
  { to: '/dashboard/containers', icon: '📦', label: 'Containers' },
  { to: '/dashboard/images',     icon: '🖼️',  label: 'Images' },
  { to: '/dashboard/stacks',     icon: '📚', label: 'Stacks' },
  { to: '/dashboard/store',      icon: '🏪', label: 'App Store' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard/users', icon: '👥', label: 'Users' },
]

function pageTitleFromPath(pathname: string): string {
  const map: Record<string, string> = {
    '/dashboard/stats':      'Dashboard',
    '/dashboard/containers': 'Containers',
    '/dashboard/images':     'Images',
    '/dashboard/stacks':     'Stacks',
    '/dashboard/store':      'App Store',
    '/dashboard/users':      'Users',
  }
  return map[pathname] || 'DockDash'
}

interface LayoutProps {
  onLogout: () => void
}

export default function Layout({ onLogout }: LayoutProps) {
  const { user } = useUserContext()
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
