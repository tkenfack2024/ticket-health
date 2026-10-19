import { useState, useEffect } from 'react'
import { Shield, Check, X, Loader2, Info } from 'lucide-react'
import { api } from '../../api'

const MODULE_COLORS = {
  kb: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  assets: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  users: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  logs: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  tickets: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const MODULE_LABELS = { kb: 'Base de connaissances', assets: 'Assets', users: 'Utilisateurs', logs: 'Journal', tickets: 'Tickets' }

export default function AdminPermissions() {
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [usersData, permsData] = await Promise.all([
        api.adminGetUsersPermissions(),
        api.adminGetPermissions(),
      ])
      setUsers(usersData)
      setPermissions(permsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (userId, code, hasIt) => {
    setUpdating(`${userId}-${code}`)
    try {
      if (hasIt) await api.adminRevokePermission(userId, code)
      else await api.adminGrantPermission(userId, code)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Shield size={22} className="text-blue-600 dark:text-blue-400" />
          Gestion des permissions
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Attribuez des droits granulaires aux utilisateurs</p>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-300">
          <p className="font-medium mb-1">Comment ça marche ?</p>
          <ul className="space-y-1 list-disc list-inside text-blue-800 dark:text-blue-400">
            <li>Les <strong>admins</strong> ont automatiquement toutes les permissions</li>
            <li>Les autres utilisateurs n'ont que les permissions <strong>cochées</strong></li>
            <li>Une permission peut être <strong>révoquée</strong> à tout moment</li>
          </ul>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Modules :</span>
        {Object.entries(MODULE_LABELS).map(([key, label]) => (
          <span key={key} className={`px-2 py-0.5 rounded text-xs font-medium ${MODULE_COLORS[key] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{label}</span>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase sticky left-0 bg-slate-50 dark:bg-slate-700 z-10 min-w-[200px]">Utilisateur</th>
              {permissions.map((p) => (
                <th key={p.code} className="text-center px-2 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${MODULE_COLORS[p.module] || 'bg-slate-100 dark:bg-slate-700'}`}>{p.module}</span>
                    <span className="text-[11px] leading-tight text-center">{p.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-800 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      user.role === 'technicien' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>{user.role}</span>
                  </div>
                </td>
                {permissions.map((perm) => {
                  const hasIt = user.permissions.includes(perm.code)
                  const isUpdating = updating === `${user.id}-${perm.code}`
                  const isAdmin = user.isAdmin
                  return (
                    <td key={perm.code} className="text-center px-2 py-3">
                      <button
                        onClick={() => !isAdmin && handleToggle(user.id, perm.code, hasIt)}
                        disabled={isAdmin || isUpdating}
                        title={isAdmin ? 'Les admins ont toutes les permissions' : hasIt ? 'Cliquer pour révoquer' : 'Cliquer pour accorder'}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors mx-auto ${
                          isAdmin ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 cursor-not-allowed' :
                          isUpdating ? 'bg-slate-100 dark:bg-slate-700' :
                          hasIt ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {isUpdating ? <Loader2 size={14} className="animate-spin text-slate-500 dark:text-slate-400" /> :
                         isAdmin ? <Shield size={14} /> :
                         hasIt ? <Check size={14} /> : <X size={14} />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Utilisateurs</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Permissions disponibles</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{permissions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Permissions accordées</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{users.reduce((sum, u) => sum + (u.isAdmin ? 0 : u.permissions.length), 0)}</p>
        </div>
      </div>
    </div>
  )
}