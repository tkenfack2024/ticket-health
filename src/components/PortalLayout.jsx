import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Home, PlusCircle, BookOpen, LogOut, Activity, Shield
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
    }`

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const canReturnToAdmin = user?.role === 'admin' || user?.role === 'technicien'

  return (
    <div className="flex h-screen overflow-hidden">
  {/* Sidebar simplifiée - FIXE */}
  <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-colors sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">HealthTicket</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Espace utilisateur</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/portal" end className={linkClass}>
            <Home size={20} />
            Mes tickets
          </NavLink>
          <NavLink to="/tickets/new" className={linkClass}>
            <PlusCircle size={20} />
            Nouveau ticket
          </NavLink>
          <NavLink to="/portal/kb" className={linkClass}>
            <BookOpen size={20} />
            Base de connaissances
          </NavLink>

          {canReturnToAdmin && (
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
              <NavLink to="/" className={linkClass}>
                <Shield size={20} />
                Retour au dashboard
              </NavLink>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-lg w-full transition-colors text-sm mt-1"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu - SCROLLABLE */}
<main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors">
  <Outlet />
</main>
    </div>
  )
}