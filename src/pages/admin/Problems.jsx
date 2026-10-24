import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bug, Plus, Search, AlertTriangle, Clock, CheckCircle, X, Loader2 } from 'lucide-react'
import { api } from '../../api'

const STATUS_CONFIG = {
  new: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Plus },
  analyzing: { label: 'En analyse', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  known_error: { label: 'Erreur connue', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle },
  resolved: { label: 'Résolu', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  closed: { label: 'Clos', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle },
}

const PRIORITY_CONFIG = {
  Urgente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Haute: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Moyenne: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Basse: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
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
        api.problemsGetAll({ search: search || undefined, status: filterStatus || undefined }),
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

  useEffect(() => { load() }, [search, filterStatus])

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bug size={22} className="text-purple-600 dark:text-purple-400" />
            Gestion des problèmes (ITIL)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{problems.length} problème(s) — Regroupement d'incidents récurrents</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">
          <Plus size={16} />Nouveau problème
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const stat = stats.by_status.find(s => s.status === key)
            const count = stat?.count || 0
            const Icon = cfg.icon
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  filterStatus === key
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={filterStatus === key ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{cfg.label}</span>
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{count}</p>
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input type="text" placeholder="Rechercher un problème..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-dark pl-10" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
        </select>
      </div>

      {problems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Bug size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucun problème</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">Les problèmes regroupent plusieurs incidents récurrents.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((problem) => <ProblemCard key={problem.id} problem={problem} />)}
        </div>
      )}

      {showCreateModal && <CreateProblemModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); load() }} />}
    </div>
  )
}

function ProblemCard({ problem }) {
  const statusCfg = STATUS_CONFIG[problem.status] || STATUS_CONFIG.new
  const StatusIcon = statusCfg.icon
  const priorityCfg = PRIORITY_CONFIG[problem.priority] || PRIORITY_CONFIG.Moyenne

  return (
    <Link to={`/admin/problems/${problem.id}`} className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all p-4 group">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">#{problem.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}><StatusIcon size={10} />{statusCfg.label}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityCfg}`}>{problem.priority}</span>
            {problem.kb_article_id && <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">📚 KEDB</span>}
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{problem.title}</h3>
          {problem.symptoms && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{problem.symptoms}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
        <span>{problem.ticket_count || 0} ticket(s) lié(s)</span>
        {problem.category && <span>Catégorie : {problem.category}</span>}
        {problem.assigned_to && <span>Assigné à : {problem.assigned_to}</span>}
        <span>Détecté le {new Date(problem.detected_at).toLocaleDateString('fr-FR')}</span>
      </div>
    </Link>
  )
}

function CreateProblemModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', symptoms: '', priority: 'Moyenne', category: '' })
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Nouveau problème</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre *</label><input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-dark" /></div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Symptômes</label><textarea rows={3} value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} className="input-dark resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priorité</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-dark"><option>Basse</option><option>Moyenne</option><option>Haute</option><option>Urgente</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-dark" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50">{loading ? 'Création...' : 'Créer'}</button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}