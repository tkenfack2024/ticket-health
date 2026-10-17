import { useState, useEffect } from 'react'
import { Shield, Check, X, Loader2, Info } from 'lucide-react'
import { api } from '../../api'

const MODULE_COLORS = {
  kb: 'bg-blue-100 text-blue-700',
  assets: 'bg-purple-100 text-purple-700',
  users: 'bg-red-100 text-red-700',
  logs: 'bg-slate-100 text-slate-700',
  tickets: 'bg-amber-100 text-amber-700',
}

const MODULE_LABELS = {
  kb: 'Base de connaissances',
  assets: 'Assets',
  users: 'Utilisateurs',
  logs: 'Journal',
  tickets: 'Tickets',
}

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
      if (hasIt) {
        await api.adminRevokePermission(userId, code)
      } else {
        await api.adminGrantPermission(userId, code)
      }
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdating(null)
    }
  }

  // Grouper les permissions par module
  const permissionsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {})

  if (loading) return <div className="p-6 text-slate-500">Chargement...</div>

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield size={22} className="text-blue-600" />
          Gestion des permissions
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Attribuez des droits granulaires aux utilisateurs (au-delà de leur rôle)
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Info */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Comment ça marche ?</p>
          <ul className="space-y-1 list-disc list-inside text-blue-800">
            <li>Les <strong>admins</strong> ont automatiquement toutes les permissions (non modifiable)</li>
            <li>Les autres utilisateurs n'ont que les permissions <strong>explicitement cochées</strong></li>
            <li>Une permission accordée peut être <strong>révoquée</strong> à tout moment</li>
          </ul>
        </div>
      </div>

      {/* Légende des modules */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 font-medium">Modules :</span>
        {Object.entries(MODULE_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={`px-2 py-0.5 rounded text-xs font-medium ${MODULE_COLORS[key] || 'bg-slate-100 text-slate-600'}`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                Utilisateur
              </th>
              {permissions.map((p) => (
                <th key={p.code} className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${MODULE_COLORS[p.module] || 'bg-slate-100'}`}>
                      {p.module}
                    </span>
                    <span className="text-[11px] leading-tight text-center">{p.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-semibold text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700' :
                      user.role === 'technicien' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
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
                        title={
                          isAdmin
                            ? 'Les admins ont toutes les permissions'
                            : hasIt
                            ? 'Cliquer pour révoquer'
                            : 'Cliquer pour accorder'
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors mx-auto ${
                          isAdmin
                            ? 'bg-red-100 text-red-600 cursor-not-allowed'
                            : isUpdating
                            ? 'bg-slate-100'
                            : hasIt
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {isUpdating ? (
                          <Loader2 size={14} className="animate-spin text-slate-500" />
                        ) : isAdmin ? (
                          <Shield size={14} />
                        ) : hasIt ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Utilisateurs</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Permissions disponibles</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{permissions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Permissions accordées</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {users.reduce((sum, u) => sum + (u.isAdmin ? 0 : u.permissions.length), 0)}
          </p>
        </div>
      </div>
    </div>
  )
}