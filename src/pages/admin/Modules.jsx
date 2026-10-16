import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Power, X, Loader2 } from 'lucide-react'
import { api } from '../../api'

const ICONS = ['Box', 'Monitor', 'HeartPulse', 'FileText', 'Building2', 'Wrench', 'Network', 'Shield', 'Package', 'Server']
const COLORS = [
  { id: 'blue', label: 'Bleu', class: 'bg-blue-500' },
  { id: 'red', label: 'Rouge', class: 'bg-red-500' },
  { id: 'amber', label: 'Ambre', class: 'bg-amber-500' },
  { id: 'green', label: 'Vert', class: 'bg-green-500' },
  { id: 'purple', label: 'Violet', class: 'bg-purple-500' },
  { id: 'slate', label: 'Gris', class: 'bg-slate-500' },
]

const colorClasses = {
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  slate: 'bg-slate-100 text-slate-600',
}

export default function AdminModules() {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.adminGetModules()
      setModules(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (m) => {
    if (!confirm(`${m.active ? 'Désactiver' : 'Activer'} le module "${m.name}" ?`)) return
    try {
      await api.adminUpdateModule(m.id, { active: !m.active })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (m) => {
    if (!confirm(`Supprimer le module "${m.name}" ?\n\nSi des tickets y sont liés, il sera seulement désactivé.`)) return
    try {
      const res = await api.adminDeleteModule(m.id)
      if (res.deactivated) {
        alert(`Module désactivé (${res.ticketCount} ticket(s) liés).`)
      }
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Modules</h2>
          <p className="text-slate-500 text-sm">Catégories de tickets dynamiques</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau module
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <div key={m.id} className={`bg-white rounded-xl border p-4 transition-colors ${
            m.active ? 'border-slate-200' : 'border-slate-100 opacity-60'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  colorClasses[m.color] || colorClasses.slate
                }`}>
                  <span className="font-bold text-sm">{m.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{m.name}</h3>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                    m.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {m.active ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-3 line-clamp-2 min-h-[2.5rem]">
              {m.description || 'Aucune description'}
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {m.ticket_count || 0} ticket(s)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(m); setShowModal(true) }}
                  title="Modifier"
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleToggle(m)}
                  title={m.active ? 'Désactiver' : 'Activer'}
                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                >
                  <Power size={15} />
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  title="Supprimer"
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ModuleModal
          module={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSuccess={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ============ MODAL ============
function ModuleModal({ module, onClose, onSuccess }) {
  const isEdit = !!module
  const [form, setForm] = useState({
    name: module?.name || '',
    description: module?.description || '',
    icon: module?.icon || 'Box',
    color: module?.color || 'blue',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await api.adminUpdateModule(module.id, form)
      } else {
        await api.adminCreateModule(form)
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">
            {isEdit ? `Modifier "${module.name}"` : 'Nouveau module'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Réseau"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="À quoi sert ce module ?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Couleur</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.id })}
                  title={c.label}
                  className={`w-8 h-8 rounded-full ${c.class} ${
                    form.color === c.id ? 'ring-2 ring-offset-2 ring-slate-800' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Icône (nom Lucide)</label>
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}