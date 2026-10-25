import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Settings,
  Activity,
  LogOut,
  LogIn,
  UserPlus,
  Shield,
  BookOpen,
  ExternalLink,
  Bell,
  Building2,
  Building,
  BarChart3,
  Bed,
  Users,
  ShieldAlert,
  Clock,
  Pill,
  Menu, // Ajouté pour le menu mobile
  X,    // Ajouté pour fermer le menu mobile
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  const { user, isAuthenticated, isAdmin, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const roleBadgeClass = {
    admin: 'bg-red-100 text-red-700',
    technicien: 'bg-amber-100 text-amber-700',
    user: 'bg-blue-100 text-blue-700',
  }[user?.role] || 'bg-slate-100 text-slate-600'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      
      {/* Overlay sombre sur mobile quand le menu est ouvert */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:sticky md:top-0 md:h-screen
      `}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">HealthTicket</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gestion de tickets</p>
            </div>
          </div>
          {/* Bouton pour fermer sur mobile */}
          <button onClick={closeMobileMenu} className="md:hidden text-slate-500 hover:text-slate-700">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" onClick={closeMobileMenu}>
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard size={20} />
            Tableau de bord
          </NavLink>
          <NavLink to="/tickets" end className={linkClass}>
            <Ticket size={20} />
            Tous les tickets
          </NavLink>
          <NavLink to="/tickets/new" className={linkClass}>
            <PlusCircle size={20} />
            Nouveau ticket
          </NavLink>
          <NavLink to="/knowledge" className={linkClass}>
            <BookOpen size={20} />
            Base de connaissances
          </NavLink>

          {/* --- LIENS AVEC PERMISSIONS GRANULAIRES --- */}
          {(isAdmin || hasPermission('supplier.manage')) && (
            <NavLink to="/admin/suppliers" className={linkClass}>
              <Building2 size={20} />
              Fournisseurs
            </NavLink>
          )}
          
          {(isAdmin || hasPermission('risk.view')) && (
            <NavLink to="/admin/risks" className={linkClass}>
              <ShieldAlert size={20} />
              Risques
            </NavLink>
          )}

          {(isAdmin || hasPermission('facility.manage')) && (
            <NavLink to="/admin/facility" className={linkClass}>
              <Building size={20} />
              Bâtiments & Salles
            </NavLink>
          )}

          {(isAdmin || hasPermission('stats.view')) && (
            <NavLink to="/admin/capacity" className={linkClass}>
              <BarChart3 size={20} />
              Capacité & Perf
            </NavLink>
          )}

          {(isAdmin || hasPermission('resource.manage')) && (
            <NavLink to="/admin/resources" className={linkClass}>
              <Bed size={20} />
              Lits & Tables
            </NavLink>
          )}

          {(isAdmin || hasPermission('patient.read')) && (
            <NavLink to="/admin/patients" className={linkClass}>
              <Users size={20} />
              Accueil Patients
            </NavLink>
          )}

          {(isAdmin || hasPermission('medical.read')) && (
            <>
              <NavLink to="/admin/waiting-room" className={linkClass}>
                <Clock size={20} />
                Salle d'attente
              </NavLink>
              
              <NavLink to="/admin/medical-followup" className={linkClass}>
                <Pill size={20} />
                Suivi Médical
              </NavLink>
            </>
          )}

          {isAdmin && (
            <NavLink to="/admin" end className={linkClass}>
              <Shield size={20} />
              Administration
            </NavLink>
          )}

          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
            <NavLink to="/portal" className={linkClass}>
              <ExternalLink size={20} />
              Portail utilisateur
            </NavLink>
          </div>
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{user.name}</p>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${roleBadgeClass}`}>
                    {user.role}
                  </span>
                </div>
              </div>

              <NavLink to="/profile/notifications" className={linkClass}>
                <Bell size={20} />
                Notifications
              </NavLink>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-lg w-full transition-colors text-sm mt-1"
              >
                <LogOut size={18} />
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                <LogIn size={20} />
                Connexion
              </NavLink>
              <NavLink to="/register" className={linkClass}>
                <UserPlus size={20} />
                Inscription
              </NavLink>
            </>
          )}
        </div>
      </aside>

      {/* Contenu principal (avec barre mobile) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure mobile */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 dark:text-slate-300">
              <Menu size={24} />
            </button>
            <Activity className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-slate-800 dark:text-slate-100">HealthTicket</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 transition-colors">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
