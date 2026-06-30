import { NavLink, useNavigate } from 'react-router-dom'
import { getAdmin, canAccess } from '../../lib/auth'

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard',  section: 'dashboard'  },
  { to: '/admin/directory', label: 'Directory',  section: 'directory'  },
  { to: '/admin/turni',     label: 'Turni',      section: 'turni'      },
  { to: '/admin/log',       label: 'LOG',        section: 'log'        },
  { to: '/admin/riepilogo', label: 'Riepilogo',  section: 'riepilogo'  },
]

const ROLE_LABEL = {
  senior:   'Senior',
  superior: 'Superior',
  visual:   'Solo lettura',
}

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const admin = getAdmin()
  const visibleNav = NAV.filter(n => canAccess(n.section))

  function logout() {
    localStorage.removeItem('admin_token')
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-petrol-900 flex">

      {/* Sidebar */}
      <aside className="w-56 bg-petrol-950 flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-petrol-800 flex flex-col gap-2">
          <img
            src="/logo.png"
            alt="HEY"
            className="h-8 w-auto object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
          />
          <p className="text-petrol-400 text-xs font-medium">Gestionale presenze</p>
        </div>

        <nav className="flex-1 py-5 flex flex-col gap-1 px-3">
          {visibleNav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-petrol-700 text-white'
                    : 'text-petrol-300 hover:bg-petrol-900 hover:text-white'
                }`
              }
            >
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
          <button
            onClick={logout}
            className="text-petrol-400 hover:text-white text-sm font-medium transition text-left"
          >
            Esci →
          </button>
        </div>
      </aside>

      {/* Contenuto */}
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>

    </div>
  )
}
