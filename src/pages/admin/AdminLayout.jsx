import { NavLink, useNavigate } from 'react-router-dom'
import { getAdmin, canAccess } from '../../lib/auth'

const NAV = [
  {
    to: '/admin/dashboard', label: 'Dashboard', section: 'dashboard',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1.2"/><rect x="9" y="1" width="6" height="6" rx="1.2"/>
        <rect x="1" y="9" width="6" height="6" rx="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.2"/>
      </svg>
    ),
  },
  {
    to: '/admin/directory', label: 'Directory', section: 'directory',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="5" r="2.8"/><path d="M2 14.5c0-3.6 2.7-6 6-6s6 2.4 6 6"/>
      </svg>
    ),
  },
  {
    to: '/admin/turni', label: 'Turni', section: 'turni',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1.5" y="3" width="13" height="11.5" rx="1.2"/><line x1="1.5" y1="7" x2="14.5" y2="7"/>
        <line x1="5" y1="1" x2="5" y2="5"/><line x1="11" y1="1" x2="11" y2="5"/>
      </svg>
    ),
  },
  {
    to: '/admin/log', label: 'LOG', section: 'log',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="9" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/admin/riepilogo', label: 'Riepilogo', section: 'riepilogo',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="2" y1="14" x2="2" y2="7"/><line x1="6" y1="14" x2="6" y2="3"/><line x1="10" y1="14" x2="10" y2="9"/><line x1="14" y1="14" x2="14" y2="1"/>
      </svg>
    ),
  },
  {
    to: '/admin/richieste', label: 'Richieste', section: 'richieste',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.2"/>
        <polyline points="1.5,4.5 8,9.5 14.5,4.5"/>
      </svg>
    ),
  },
  {
    to: '/admin/statistiche', label: 'Statistiche', section: 'statistiche',
    icon: (
      <svg viewBox="0 0 16 16" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="9" width="3" height="6" rx="0.8"/>
        <rect x="6" y="5" width="3" height="10" rx="0.8"/>
        <rect x="11" y="2" width="3" height="13" rx="0.8"/>
      </svg>
    ),
  },
]

const ROLE_LABEL = {
  senior:   'Senior',
  superior: 'Superior',
  visual:   'Solo lettura',
}

export default function AdminLayout({ children }) {
  const navigate   = useNavigate()
  const admin      = getAdmin()
  const visibleNav = NAV.filter(n => canAccess(n.section))

  function logout() {
    localStorage.removeItem('admin_token')
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-petrol-900 md:flex">

      {/* ── Sidebar desktop ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 bg-petrol-950 flex-col shrink-0">
        <div className="px-6 py-6 border-b border-petrol-800 flex flex-col gap-2">
          <img src="/logo.png" alt="HEY" className="h-8 w-auto object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <p className="text-petrol-400 text-xs font-medium">Gestionale presenze</p>
        </div>

        <nav className="flex-1 py-5 flex flex-col gap-1 px-3">
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-petrol-700 text-white' : 'text-petrol-300 hover:bg-petrol-900 hover:text-white'
                }`
              }>
              <span className="opacity-70">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-5 border-t border-petrol-800 flex flex-col gap-1">
          {admin && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{admin.name}</p>
                <p className="text-petrol-500 text-xs">{ROLE_LABEL[admin.role] || admin.role}</p>
              </div>
            </div>
          )}
          <a href="https://heyrestaurant.it/admin" target="_blank" rel="noopener noreferrer"
            className="text-petrol-400 hover:text-white text-sm font-medium transition mb-2">
            HEY Supports ↗
          </a>
          <button onClick={logout}
            className="text-petrol-400 hover:text-white text-sm font-medium transition text-left">
            Esci →
          </button>
        </div>
      </aside>

      {/* ── Header mobile ─────────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-petrol-950 border-b border-petrol-800 h-14 px-4 flex items-center justify-between">
        <img src="/logo.png" alt="HEY" className="h-7 w-auto object-contain"
          style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
        <div className="flex items-center gap-3">
          {admin && (
            <span className="text-petrol-400 text-xs font-semibold hidden sm:inline">{admin.name}</span>
          )}
          <button onClick={logout}
            className="text-petrol-500 hover:text-white text-xs font-semibold uppercase tracking-wider transition">
            Esci
          </button>
        </div>
      </header>

      {/* ── Contenuto ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto
        pt-14 md:pt-0
        pb-24 md:pb-0
        px-4 py-4 md:p-10">
        {children}
      </main>

      {/* ── Bottom nav mobile ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-petrol-950 border-t border-petrol-800 safe-area-bottom">
        <div className="flex">
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2.5 transition ${
                  isActive ? 'text-white' : 'text-petrol-600 hover:text-petrol-300'
                }`
              }>
              {icon}
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  )
}
