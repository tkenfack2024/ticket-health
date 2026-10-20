import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, GitBranch, AlertTriangle, CheckCircle, Clock,
  X, Loader2, FileText, Shield, Zap, Play, RotateCcw, Lock,
  Calendar, User, TrendingDown, Search,
} from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: FileText },
  analyzing: { label: 'En analyse', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Search },
  pending_approval: { label: 'En attente d\'approbation', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  scheduled: { label: 'Planifiée', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Calendar },
  in_progress: { label: 'En cours', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Play },
  implemented: { label: 'Réalisée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rolled_back: { label: 'Rollback', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: RotateCcw },
  closed: { label: 'Clôturée', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: Lock },
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

export default function ChangeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [change, setChange] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.changesGet(id)
      setChange(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (actionFn, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setActionLoading(true)
    try {
      await actionFn()
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement...</div>
  if (error && !change) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>
  if (!change) return null

  const statusCfg = STATUS_CONFIG[change.status] || STATUS_CONFIG.draft
  const typeCfg = TYPE_CONFIG[change.change_type] || TYPE_CONFIG.normal
  const riskCfg = RISK_CONFIG[change.risk_level] || RISK_CONFIG.medium
  const StatusIcon = statusCfg.icon
  const TypeIcon = typeCfg.icon

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/admin" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} />
        Retour
      </Link>

      {/* En-tête */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">RFC #{change.id}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                <StatusIcon size={11} />
                {statusCfg.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeCfg.color}`}>
                <TypeIcon size={11} />
                {typeCfg.label}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskCfg.color}`}>
                Risque : {riskCfg.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{change.title}</h1>
          </div>
        </div>

        {change.description && (
          <p className="text-slate-600 dark:text-slate-300 mb-4">{change.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Demandé par</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{change.requested_by_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Priorité</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{change.priority}</p>
          </div>
          {change.approved_by_name && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Approuvé par</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{change.approved_by_name}</p>
            </div>
          )}
        </div>

        {change.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Motif de refus :</strong> {change.rejection_reason}
            </p>
          </div>
        )}

        {/* Actions selon le statut */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          {(change.status === 'draft' || change.status === 'analyzing') && (
            <button
              onClick={() => handleAction(() => api.changesSubmit(id), 'Soumettre ce changement ?')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {actionLoading && <Loader2 size={14} className="animate-spin" />}
              Soumettre pour approbation
            </button>
          )}

          {change.status === 'pending_approval' && isAdmin && (
            <>
              <button
                onClick={() => handleAction(() => api.changesApprove(id), 'Approuver ce changement ?')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Approuver
              </button>
              <button
                onClick={() => setRejectModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                <X size={16} />
                Refuser
              </button>
            </>
          )}

          {change.status === 'scheduled' && (
            <button
              onClick={() => handleAction(() => api.changesStart(id), 'Démarrer l\'implémentation ?')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
            >
              <Play size={16} />
              Démarrer
            </button>
          )}

          {change.status === 'in_progress' && (
            <>
              <button
                onClick={() => handleAction(() => api.changesComplete(id), 'Marquer comme réalisée ?')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Marquer comme réalisée
              </button>
              <button
                onClick={() => handleAction(() => api.changesRollback(id), '⚠️ Effectuer un rollback ?')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                <RotateCcw size={16} />
                Rollback
              </button>
            </>
          )}

          {(change.status === 'implemented' || change.status === 'rolled_back') && (
            <button
              onClick={() => handleAction(() => api.changesClose(id), 'Clôturer ce changement ?')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 text-sm font-medium disabled:opacity-50"
            >
              <Lock size={16} />
              Clôturer
            </button>
          )}
        </div>
      </div>

      {/* Détails */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {change.implementation_plan && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Plan d'implémentation</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{change.implementation_plan}</p>
          </div>
        )}

        {change.rollback_plan && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <RotateCcw size={18} className="text-orange-600" />
              Plan de rollback
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{change.rollback_plan}</p>
          </div>
        )}

        {change.scheduled_start && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Calendar size={18} className="text-purple-600" />
              Planification
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Début :</span>{' '}
                <span className="text-slate-800 dark:text-slate-100">{formatDate(change.scheduled_start)}</span>
              </div>
              {change.scheduled_end && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Fin :</span>{' '}
                  <span className="text-slate-800 dark:text-slate-100">{formatDate(change.scheduled_end)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {change.affected_cis && change.affected_cis.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <TrendingDown size={18} className="text-red-600" />
              CIs impactés ({change.affected_cis.length})
            </h2>
            <div className="space-y-2 text-sm">
              {change.affected_cis.map((ci) => (
                <div key={ci.id || ci} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                  <span className="text-slate-700 dark:text-slate-300">{ci.name || `CI #${ci}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tickets liés */}
      {change.tickets && change.tickets.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mt-6">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Tickets liés ({change.tickets.length})
          </h2>
          <div className="space-y-2">
            {change.tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <span className="text-sm text-slate-800 dark:text-slate-100">#{ticket.id} — {ticket.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Modal refus */}
      {rejectModal && (
        <RejectModal
          changeId={id}
          onClose={() => setRejectModal(false)}
          onSuccess={() => { setRejectModal(false); load() }}
        />
      )}
    </div>
  )
}

function RejectModal({ changeId, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.changesReject(changeId, reason)
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
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Refuser le changement</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motif *</label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez pourquoi ce changement est refusé..."
              className="input-dark resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Refuser'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}