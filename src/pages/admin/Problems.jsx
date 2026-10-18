import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bug, Plus, Search, AlertTriangle, Clock, CheckCircle,
  Filter, TrendingUp
} from 'lucide-react'
import { api } from '../../api'

const STATUS_CONFIG = {
  new: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700', icon: Plus },
  analyzing: { label: 'En analyse', color: 'bg-amber-100 text-amber-700', icon: Clock },
  known_error: { label: 'Erreur connue', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  resolved: { label: 'Résolu', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Clos', color: 'bg-slate-100 text-slate-600', icon: CheckCircle },
}

const PRIORITY_CONFIG = {
  Urgente: 'bg-red-100 text-red-700',
  Haute: 'bg-orange-100 text-orange-700',
  Moyenne: 'bg-yellow-100 text-yellow-700',
  Basse: 'bg-slate-100 text-slate-600',
}

export default function AdminProblems() {
  const [problems, setProblems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [problemsData, statsData] = await Promise.all([
        api.problemsGetAll({
          search: search || undefined,
          status: filterStatus || undefined,
        }),
        api.problemsGetStats(),
      ])
      setProblems(problemsData)
      setStats(statsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [search, filterStatus])

  if (loading) return <div className="p-6 text-slate-500">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bug size={22} className="text-purple-600" />
            Gestion des problèmes (ITIL)
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {problems.length} problème(s) — Regroupement d'incidents récurrents
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau problème
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const stat = stats.by_status.find(s => s.status === key)
            const count = stat?.count || 0
            const Icon = cfg.icon
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  filterStatus === key
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={filterStatus === key ? 'text-purple-600' : 'text-slate-400'} />
                  <span className="text-xs text-slate-600">{cfg.label}</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{count}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un problème..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {problems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bug size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun problème</p>
          <p className="text-slate-400 text-sm">
            Les problèmes regroupent plusieurs incidents récurrents pour identifier leur cause racine.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProblemModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); load() }}
        />
      )}
    </div>
  )
}

function ProblemCard({ problem }) {
  const statusCfg = STATUS_CONFIG[problem.status] || STATUS_CONFIG.new
  const StatusIcon = statusCfg.icon
  const priorityCfg = PRIORITY_CONFIG[problem.priority] || PRIORITY_CONFIG.Moyenne

  return (
    <Link
      to={`/admin/problems/${problem.id}`}
      className="block bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all p-4 group"
    >
      <div className="flex justify-between items-start gap-4 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-slate-500">#{problem.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon size={10} />
              {statusCfg.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityCfg}`}>
              {problem.priority}
            </span>
            {problem.kb_article_id && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                📚 KEDB
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
            {problem.title}
          </h3>
          {problem.symptoms && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{problem.symptoms}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>{problem.ticket_count || 0} ticket(s) lié(s)</span>
        {problem.category && <span>Catégorie : {problem.category}</span>}
        {problem.assigned_to && <span>Assigné à : {problem.assigned_to}</span>}
        <span>Détecté le {new Date(problem.detected_at).toLocaleDateString('fr-FR')}</span>
      </div>
    </Link>
  )
}

function CreateProblemModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    symptoms: '',
    priority: 'Moyenne',
    category: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.problemsCreate(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-bold text-slate-800 mb-4">Nouveau problème</h3>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre *</label>
            <input
              type="text" required value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Pannes récurrentes imprimante HP"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Symptômes</label>
            <textarea
              rows={3} value={form.symptoms}
              onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
              placeholder="Description des symptômes observés..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={inputClass}
              >
                <option>Basse</option>
                <option>Moyenne</option>
                <option>Haute</option>
                <option>Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
              <input
                type="text" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Informatique"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
            <button
              type="button" onClick={onClose} disabled={loading}
              className="flex-1 border border-slate-200 py-2 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}