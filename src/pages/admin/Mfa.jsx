import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck, Search, Loader2 } from 'lucide-react'
import { api } from '../../api'

export default function AdminMfa() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.adminGetUsers() // On réutilise la route existante
      setUsers(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleForceDisable = async (userId, userName) => {
    if (!confirm(`Désactiver de force le MFA pour ${userName} ?\n\nL'utilisateur devra le réactiver s'il le souhaite.`)) return
    
    setActionLoading(userId)
    try {
      await api.post(`/api/admin/users/${userId}/mfa/disable`)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Shield size={22} className="text-blue-600" />
          Administration du MFA
        </h2>
        <p className="text-slate-500 text-sm mt-1">Gérez l'authentification à deux facteurs des utilisateurs</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 bg-transparent rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Utilisateur</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Rôle</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Statut MFA</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600">
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {u.mfa_enabled === 1 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <ShieldCheck size={12} /> Activé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      <ShieldAlert size={12} /> Désactivé
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {u.mfa_enabled === 1 && (
                    <button
                      onClick={() => handleForceDisable(u.id, u.name)}
                      disabled={actionLoading === u.id}
                      className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : 'Forcer la désactivation'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}