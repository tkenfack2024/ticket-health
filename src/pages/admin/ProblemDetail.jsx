import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bug, AlertTriangle, CheckCircle, Clock,
  Plus, Save, X, Loader2, BookOpen, Link as LinkIcon,
  ExternalLink, FileText, TrendingDown
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

// Workflow ITIL
const WORKFLOW = ['new', 'analyzing', 'known_error', 'resolved', 'closed']

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

export default function ProblemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [problem, setProblem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [showLinkModal, setShowLinkModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.problemsGet(id)
      setProblem(data)
      setForm({
        title: data.title,
        symptoms: data.symptoms || '',
        root_cause: data.root_cause || '',
        workaround: data.workaround || '',
        priority: data.priority,
        category: data.category || '',
      })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleStatusChange = async (newStatus) => {
    try {
      await api.problemsUpdate(id, { status: newStatus })
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.problemsUpdate(id, form)
      setEditing(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateKb = async () => {
    if (!confirm('Créer un article KEDB à partir de ce problème ?\n\nL\'article sera publié dans la base de connaissances.')) return
    try {
      const result = await api.problemsCreateKb(id)
      alert(`Article KEDB créé ! ID: ${result.kb_article_id}`)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUnlinkTicket = async (ticketId) => {
    if (!confirm('Délier ce ticket du problème ?')) return
    try {
      await api.problemsUnlinkTicket(id, ticketId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>
  if (error && !problem) return <div className="p-8 text-red-600">{error}</div>
  if (!problem) return null

  const statusCfg = STATUS_CONFIG[problem.status] || STATUS_CONFIG.new
  const StatusIcon = statusCfg.icon
  const priorityCfg = PRIORITY_CONFIG[problem.priority] || PRIORITY_CONFIG.Moyenne
  const currentStatusIndex = WORKFLOW.indexOf(problem.status)

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/admin" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={18} />
        Retour à l'administration
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm font-mono text-slate-500">#{problem.id}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                <StatusIcon size={11} />
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
            <h1 className="text-2xl font-bold text-slate-800">{problem.title}</h1>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              editing
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {editing ? <X size={16} /> : <Save size={16} />}
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {/* Workflow */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Workflow ITIL</p>
          <div className="flex items-center gap-2 flex-wrap">
            {WORKFLOW.map((status, index) => {
              const cfg = STATUS_CONFIG[status]
              const Icon = cfg.icon
              const isActive = problem.status === status
              const isPast = index < currentStatusIndex

              return (
                <div key={status} className="flex items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(status)}
                    disabled={isActive}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? `${cfg.color} ring-2 ring-offset-1 ring-current cursor-default`
                        : isPast
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={14} />
                    {cfg.label}
                  </button>
                  {index < WORKFLOW.length - 1 && (
                    <div className={`h-0.5 w-6 ${isPast ? 'bg-slate-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Colonne gauche */}
        <div className="space-y-6">
          {/* Symptômes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-3">Symptômes</h2>
            {editing ? (
              <textarea
                rows={4}
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-line">
                {problem.symptoms || <span className="text-slate-400 italic">Non renseignés</span>}
              </p>
            )}
          </div>

          {/* Cause racine */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingDown size={18} className="text-amber-600" />
              Cause racine
            </h2>
            {editing ? (
              <textarea
                rows={4}
                value={form.root_cause}
                onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
                placeholder="Décrivez la cause racine identifiée..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-line">
                {problem.root_cause || <span className="text-slate-400 italic">En cours d'analyse</span>}
              </p>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Workaround */}
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
            <h2 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              Workaround
            </h2>
            {editing ? (
              <textarea
                rows={4}
                value={form.workaround}
                onChange={(e) => setForm({ ...form, workaround: e.target.value })}
                placeholder="Solution temporaire en attendant un correctif..."
                className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm bg-white"
              />
            ) : (
              <p className="text-sm text-orange-800 whitespace-pre-line">
                {problem.workaround || <span className="text-orange-400 italic">Aucun workaround documenté</span>}
              </p>
            )}

            {/* Bouton KEDB */}
            {!editing && problem.workaround && !problem.kb_article_id && (
              <button
                onClick={handleCreateKb}
                className="mt-4 flex items-center gap-2 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-xs font-medium"
              >
                <BookOpen size={14} />
                Créer un article KEDB
              </button>
            )}
            {problem.kb_article_id && (
              <Link
                to={`/knowledge/${problem.kb_article_id}`}
                className="mt-4 inline-flex items-center gap-2 text-orange-700 hover:underline text-xs font-medium"
              >
                <ExternalLink size={14} />
                Voir l'article KEDB #{problem.kb_article_id}
              </Link>
            )}
          </div>

          {/* Infos */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-3">Informations</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Catégorie</p>
                <p className="text-slate-800">{problem.category || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Assigné à</p>
                <p className="text-slate-800">{problem.assigned_to || 'Non assigné'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Détecté le</p>
                <p className="text-slate-800">{formatDate(problem.detected_at)}</p>
              </div>
              {problem.resolved_at && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Résolu le</p>
                  <p className="text-slate-800">{formatDate(problem.resolved_at)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Créé par</p>
                <p className="text-slate-800">{problem.created_by_name || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons de sauvegarde */}
      {editing && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer les modifications
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Tickets liés */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <LinkIcon size={18} className="text-blue-600" />
            Tickets liés ({problem.tickets?.length || 0})
          </h2>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-xs font-medium"
          >
            <Plus size={14} />
            Lier un ticket
          </button>
        </div>

        {problem.tickets && problem.tickets.length > 0 ? (
          <div className="space-y-2">
            {problem.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="font-medium text-sm text-slate-800 hover:text-blue-600"
                  >
                    #{ticket.id} — {ticket.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ticket.status} • {ticket.priority} • Lié par {ticket.linked_by_name}
                  </p>
                </div>
                <button
                  onClick={() => handleUnlinkTicket(ticket.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Délier"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm">
            Aucun ticket lié. Cliquez sur "Lier un ticket" pour associer des incidents à ce problème.
          </div>
        )}
      </div>

      {showLinkModal && (
        <LinkTicketModal
          problemId={parseInt(id)}
          existingTicketIds={problem.tickets?.map(t => t.id) || []}
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => { setShowLinkModal(false); load() }}
        />
      )}
    </div>
  )
}

// ============ MODAL : Lier un ticket ============
function LinkTicketModal({ problemId, existingTicketIds, onClose, onSuccess }) {
  const [tickets, setTickets] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(null)

  useEffect(() => {
    api.getTickets()
      .then(data => {
        const available = data.filter(t => !existingTicketIds.includes(t.id))
        setTickets(available)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const handleLink = async (ticketId) => {
    setLinking(ticketId)
    try {
      await api.problemsLinkTicket(problemId, ticketId)
      onSuccess()
    } catch (err) {
      alert(err.message)
      setLinking(null)
    }
  }

  const filtered = tickets.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Lier un ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher un ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-4">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            {search ? 'Aucun ticket trouvé' : 'Tous les tickets sont déjà liés'}
          </p>
        ) : (
          <div className="space-y-2 overflow-y-auto">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => handleLink(ticket.id)}
                disabled={linking === ticket.id}
                className="w-full text-left flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800">
                    #{ticket.id} — {ticket.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ticket.status} • {ticket.priority}
                  </p>
                </div>
                {linking === ticket.id ? (
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                ) : (
                  <LinkIcon size={14} className="text-slate-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}