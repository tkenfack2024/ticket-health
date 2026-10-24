import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, Monitor, Shield, Mail, Printer, BookOpen,
  Clock, CheckCircle, XCircle, Loader2, ExternalLink,
} from 'lucide-react'
import { api } from '../../api'

const ICONS = {
  Monitor, Shield, Mail, Printer, BookOpen, Package,
}

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

const STATUS_CONFIG = {
  pending_approval: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  approved: { label: 'Approuvée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  rejected: { label: 'Refusée', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
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

export default function MyRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.catalogGetMyRequests()
      setRequests(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mes demandes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {requests.length} demande(s) de service
          </p>
        </div>
        <Link
          to="/portal/catalog"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Package size={18} />
          Nouvelle demande
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Package size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucune demande</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">
            Faites votre première demande depuis le catalogue
          </p>
          <Link
            to="/portal/catalog"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const Icon = ICONS[request.service_icon] || Package
            const colorClass = COLOR_CLASSES[request.service_color] || COLOR_CLASSES.slate
            const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending_approval
            const StatusIcon = statusCfg.icon

            return (
              <div
                key={request.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className={`p-2.5 rounded-lg ${colorClass} flex-shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        #{request.id}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                      {request.service_name}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Demandé le {formatDate(request.created_at)}
                  </span>
                  {request.approved_by_name && (
                    <span>Approuvé par {request.approved_by_name}</span>
                  )}
                  {request.rejection_reason && (
                    <span className="text-red-600 dark:text-red-400">
                      Motif : {request.rejection_reason}
                    </span>
                  )}
                  {request.ticket_id && (
                    <Link
                      to={`/portal/tickets/${request.ticket_id}`}
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink size={12} />
                      Voir le ticket #{request.ticket_id}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}