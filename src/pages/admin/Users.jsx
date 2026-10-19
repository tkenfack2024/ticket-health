import { useState, useEffect } from 'react'
import { Plus, UserX, UserCheck, KeyRound, Pencil, X, Loader2, Shield } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  technicien: { label: 'Technicien', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  user: { label: 'Utilisateur', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [resettingUser, setResettingUser] = useState(null)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await api.adminGetUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleToggleActive = async (u) => {
    if (u.id === currentUser.id) return
    if (!confirm(`${u.active ? 'Désactiver' : 'Activer'} ${u.name} ?`)) return
    try {
      if (u.active) await api.adminDeactivateUser(u.id)
      else await api.adminUpdateUser(u.id, { active: true })
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRoleChange = async (u, newRole) => {
    if (u.id === currentUser.id) return
    try {
      await api.adminUpdateUser(u.id, { role: newRole })
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Utilisateurs</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{users.length} utilisateur(s)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Nouvel utilisateur
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Nom</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Rôle</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Statut</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id
              return (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{u.name}</span>
                      {isSelf && <span className="text-xs text-slate-400 dark:text-slate-500">(vous)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_LABELS[u.role].color}`}>
                        {ROLE_LABELS[u.role].label}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="user">Utilisateur</option>
                        <option value="technicien">Technicien</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      u.active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {u.active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setResettingUser(u)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                        title="Réinitialiser mot de passe"
                      >
                        <KeyRound size={16} />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded ${
                            u.active
                              ? 'text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                        >
                          {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); loadUsers() }} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSuccess={() => { setEditingUser(null); loadUsers() }} />
      )}
      {resettingUser && (
        <ResetPasswordModal user={resettingUser} onClose={() => setResettingUser(null)} onSuccess={() => setResettingUser(null)} />
      )}
    </div>
  )
}

function CreateUserModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminCreateUser(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Nouvel utilisateur">
      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom complet *">
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
        </Field>
        <Field label="Email *">
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" />
        </Field>
        <Field label="Téléphone">
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark" />
        </Field>
        <Field label="Mot de passe *">
          <input type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-dark" />
        </Field>
        <Field label="Rôle *">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-dark">
            <option value="user">Utilisateur</option>
            <option value="technicien">Technicien</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <ModalButtons onCancel={onClose} loading={loading} submitLabel="Créer" />
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminUpdateUser(user.id, form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title={`Modifier ${user.name}`}>
      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom complet">
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
        </Field>
        <Field label="Téléphone">
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark" />
        </Field>
        <ModalButtons onCancel={onClose} loading={loading} submitLabel="Enregistrer" />
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.adminResetPassword(user.id, newPassword)
      alert('Mot de passe réinitialisé.')
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title={`Reset mot de passe de ${user.name}`}>
      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nouveau mot de passe">
          <input type="text" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-dark" />
        </Field>
        <ModalButtons onCancel={onClose} loading={loading} submitLabel="Réinitialiser" />
      </form>
    </Modal>
  )
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ModalButtons({ onCancel, loading, submitLabel }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
        {loading && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={loading} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">
        Annuler
      </button>
    </div>
  )
}