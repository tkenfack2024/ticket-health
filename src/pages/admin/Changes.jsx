import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  GitBranch, Plus, Search, AlertTriangle, CheckCircle, Clock,
  Loader2, X, FileText, Shield, Zap, ArrowRight,
} from 'lucide-react'
import { api } from '../../api'

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: FileText },
  analyzing: { label: 'En analyse', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Search },
  pending_approval: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  scheduled: { label: 'Planifiée', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Clock },
  in_progress: { label: 'En cours', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Loader2 },
  implemented: { label: 'Réalisée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rolled_back: { label: 'Rollback', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: X },
  closed: { label: 'Clôturée', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle },
}

const TYPE_CONFIG = {
  standard: { label: 'Standard', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: GitBranch },
  emergency: { label: 'Urgence', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Zap },
}

const RISK_CONFIG = {
  low: { label: 'Faible', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: 'Moyen', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Élevé', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Critique', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

export default function AdminChanges() {
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    load()
  }, [filterStatus, filterType])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.changesGetAll({
        status: filterStatus || undefined,
        type: filterType || undefined,
      })
      setChanges(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = changes.filter(c => {
    if (search) {
      const s = search.toLowerCase()
      return c.title.toLowerCase().includes(s)
    }
    return true
  })

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GitBranch size={22} className="text-purple-600 dark:text-purple-400" />
            Gestion des changements (RFC)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {changes.length} changement(s) — Workflow ITIL
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau changement
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: 'pending_approval', label: 'En attente', color: 'amber' },
          { key: 'scheduled', label: 'Planifiées', color: 'purple' },
          { key: 'in_progress', label: 'En cours', color: 'orange' },
          { key: 'implemented', label: 'Réalisées', color: 'green' },
        ].map(({ key, label }) => {
          const count = changes.filter(c => c.status === key).length
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
              className={`rounded-xl border p-3 text-left transition-all ${
                filterStatus === key
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Rechercher un changement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark pl-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-dark max-w-[200px]"
        >
          <option value="">Tous les types</option>
          <option value="standard">Standard</option>
          <option value="normal">Normal</option>
          <option value="emergency">Urgence</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <GitBranch size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucun changement</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Créez votre premier RFC pour démarrer
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((change) => <ChangeCard key={change.id} change={change} />)}
        </div>
      )}

      {showModal && (
        <CreateChangeModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ============ CARTE ============
function ChangeCard({ change }) {
  const statusCfg = STATUS_CONFIG[change.status] || STATUS_CONFIG.draft
  const typeCfg = TYPE_CONFIG[change.change_type] || TYPE_CONFIG.normal
  const riskCfg = RISK_CONFIG[change.risk_level] || RISK_CONFIG.medium
  const StatusIcon = statusCfg.icon
  const TypeIcon = typeCfg.icon

  const cisCount = change.affected_cis ? (() => {
    try { return JSON.parse(change.affected_cis).length } catch { return 0 }
  })() : 0

  return (
    <Link
      to={`/admin/changes/${change.id}`}
      className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all p-4 group"
    >
      <div className="flex justify-between items-start gap-4 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">RFC #{change.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon size={10} />
              {statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeCfg.color}`}>
              <TypeIcon size={10} />
              {typeCfg.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskCfg.color}`}>
              Risque : {riskCfg.label}
            </span>
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {change.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
        <span>Par <strong className="text-slate-700 dark:text-slate-300">{change.requested_by_name || '—'}</strong></span>
        {change.scheduled_start && (
          <span>Planifié : {formatDate(change.scheduled_start)}</span>
        )}
        {cisCount > 0 && <span>{cisCount} CI(s) impacté(s)</span>}
        <span>Créé le {formatDate(change.created_at)}</span>
      </div>
    </Link>
  )
}

// ============ MODAL CRÉATION ============
function CreateChangeModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    change_type: 'normal',
    category: '',
    priority: 'Moyenne',
    risk_level: 'medium',
    scheduled_start: '',
    scheduled_end: '',
    implementation_plan: '',
    rollback_plan: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.changesCreate(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Nouveau changement (RFC)</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Mise à jour serveur web v2.0"
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez le changement..."
              className="input-dark resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <select
                value={form.change_type}
                onChange={(e) => setForm({ ...form, change_type: e.target.value })}
                className="input-dark"
              >
                <option value="standard">Standard (pré-approuvé)</option>
                <option value="normal">Normal (approbation requise)</option>
                <option value="emergency">Urgence (approbation rapide)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Niveau de risque</label>
              <select
                value={form.risk_level}
                onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
                className="input-dark"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="critical">Critique</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="input-dark"
              >
                <option>Basse</option>
                <option>Moyenne</option>
                <option>Haute</option>
                <option>Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Infrastructure"
                className="input-dark"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Début planifié</label>
              <input
                type="datetime-local"
                value={form.scheduled_start}
                onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fin planifiée</label>
              <input
                type="datetime-local"
                value={form.scheduled_end}
                onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan d'implémentation</label>
            <textarea
              rows={3}
              value={form.implementation_plan}
              onChange={(e) => setForm({ ...form, implementation_plan: e.target.value })}
              placeholder="Étapes pour réaliser le changement..."
              className="input-dark resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan de rollback</label>
            <textarea
              rows={3}
              value={form.rollback_plan}
              onChange={(e) => setForm({ ...form, rollback_plan: e.target.value })}
              placeholder="Comment revenir en arrière en cas de problème..."
              className="input-dark resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Créer le RFC
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}