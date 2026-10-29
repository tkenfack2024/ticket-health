import { useState, useEffect } from 'react'
import { Shield, Check, X, Loader2, Info, Plus, Users, Briefcase } from 'lucide-react'
import { api } from '../../api'

const MODULE_COLORS = {
  kb: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  assets: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  users: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  logs: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  tickets: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  stock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const MODULE_LABELS = { kb: 'Base de connaissances', assets: 'Assets', users: 'Utilisateurs', logs: 'Journal', tickets: 'Tickets', medical: 'Médical' }

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [updating, setUpdating] = useState(null)
  const [roles, setRoles] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [rolePermissions, setRolePermissions] = useState([])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersData, permsData, rolesData] = await Promise.all([
        api.adminGetUsersPermissions(),
        api.adminGetPermissions(),
        api.adminGetRoles(),
      ])
      setUsers(usersData)
      setPermissions(permsData)
      setRoles(rolesData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ==================== ACTIONS UTILISATEURS ====================
  const handleToggleUserPerm = async (userId, code, hasIt) => {
    setUpdating(`${userId}-${code}`)
    try {
      if (hasIt) await api.adminRevokePermission(userId, code)
      else await api.adminGrantPermission(userId, code)
      
      // Mise à jour locale pour une réaction instantanée
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u
        const newPerms = hasIt 
          ? (u.permissions || []).filter(p => p !== code)
          : [...(u.permissions || []), code]
        return { ...u, permissions: newPerms }
      }))
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdating(null)
    }
  }

  // ==================== ACTIONS RÔLES ====================
  const handleSelectRole = async (role) => {
    setSelectedRole(role)
    setRolePermissions([]) // On vide avant de charger
    try {
      const perms = await api.adminGetRolePermissions(role.id)
      setRolePermissions(perms)
    } catch (err) {
      console.error('Erreur chargement permissions rôle:', err)
    }
  }

  const handleToggleRolePerm = async (code, hasIt) => {
    if (!selectedRole) return
    
    try {
      // 1. On tente l'ajout ou la suppression
      if (hasIt) {
        await api.adminRemoveRolePermission(selectedRole.id, code)
      } else {
        await api.adminAddRolePermission(selectedRole.id, code)
      }
    } catch (err) {
      // 2. Si le backend dit "déjà accordée" (erreur 400), on ignore pour forcer la synchro
      if (!err.message.includes('déjà accordée')) {
        alert(err.message)
        return
      }
    }

    // 3. Quoi qu'il arrive, on recharge l'état réel depuis le serveur
    try {
      const freshPerms = await api.adminGetRolePermissions(selectedRole.id)
      setRolePermissions(freshPerms)
      
      const freshRoles = await api.adminGetRoles()
      setRoles(freshRoles)
      
      const updatedSelected = freshRoles.find(r => r.id === selectedRole.id)
      if (updatedSelected) setSelectedRole(updatedSelected)
      
    } catch (e) {
      console.error('Erreur synchro:', e)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Shield size={22} className="text-blue-600 dark:text-blue-400" />
            Gestion des droits
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gérez les permissions des utilisateurs et des rôles</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'roles' && (
            <button onClick={() => setShowRoleModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus size={16} /> Nouveau Rôle
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 text-sm font-medium">
            <Plus size={16} /> Nouvelle Permission
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          <Users size={18} /> Utilisateurs
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'roles' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          <Briefcase size={18} /> Rôles
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-300">
              <p className="font-medium mb-1">Permissions individuelles</p>
              <p className="text-blue-800 dark:text-blue-400">Les permissions cochées ici s'ajoutent à celles du rôle personnalisé de l'utilisateur.</p>
            </div>
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
                        <div className="ml-auto flex flex-col gap-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                            user.role === 'admin' ? 'bg-red-100 text-red-700' :
                            user.role === 'technicien' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>{user.role}</span>
                          {user.custom_role && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{user.custom_role}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {permissions.map((perm) => {
                      const hasIt = (user.permissions || []).includes(perm.code)
                      const isUpdating = updating === `${user.id}-${perm.code}`
                      const isAdmin = user.isAdmin
                      return (
                        <td key={perm.code} className="text-center px-2 py-3">
                          <button
                            onClick={() => !isAdmin && handleToggleUserPerm(user.id, perm.code, hasIt)}
                            disabled={isAdmin || isUpdating}
                            className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto ${
                              isAdmin ? 'bg-red-100 text-red-600 cursor-not-allowed' :
                              isUpdating ? 'bg-slate-100' :
                              hasIt ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                              'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {isUpdating ? <Loader2 size={14} className="animate-spin" /> :
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
        </>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            {roles.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aucun rôle. Cliquez sur "Nouveau Rôle".</p>
            ) : (
              roles.map(r => (
                <div
                  key={r.id}
                  onClick={() => handleSelectRole(r)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedRole?.id === r.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                >
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{r.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.description || 'Aucune description'}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{r.user_count} utilisateur(s)</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{r.perm_count} perm(s)</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedRole ? (
            <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100">Permissions : {selectedRole.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {permissions.map(p => {
                  const hasIt = rolePermissions.includes(p.code)
                  return (
                    <button
                      key={p.code}
                      onClick={() => handleToggleRolePerm(p.code, hasIt)}
                      className={`p-3 rounded-lg border text-sm text-left flex justify-between items-center transition-colors ${
                        hasIt
                          ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                          : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-700/50 dark:border-slate-600 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{p.label}</p>
                        <p className="text-[10px] font-mono opacity-70">{p.code}</p>
                      </div>
                      {hasIt ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="col-span-1 md:col-span-2 flex items-center justify-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <p className="text-slate-500 italic">Sélectionnez un rôle pour gérer ses permissions.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <PermissionModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); loadData() }} />
      )}
      {showRoleModal && (
        <RoleModal onClose={() => setShowRoleModal(false)} onSuccess={() => { setShowRoleModal(false); loadData() }} />
      )}
    </div>
  )
}

function RoleModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminCreateRole(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Créer un rôle</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nom du rôle (ex: Médecin) *</label>
            <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-dark" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-dark resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              {loading ? 'Création...' : 'Créer le rôle'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PermissionModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ code: '', label: '', module: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminCreatePermission(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Créer une permission</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Code (ex: stock.read) *</label>
            <input required type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="input-dark font-mono" placeholder="module.action" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Label (ex: Lire les stocks) *</label>
            <input required type="text" value={form.label} onChange={e => setForm({...form, label: e.target.value})} className="input-dark" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Module (ex: stock) *</label>
            <input required type="text" value={form.module} onChange={e => setForm({...form, module: e.target.value})} className="input-dark" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-dark resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              {loading ? 'Création...' : 'Créer la permission'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}