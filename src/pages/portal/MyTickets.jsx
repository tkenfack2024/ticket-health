import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Ticket, Plus, Clock, CheckCircle, AlertTriangle,
  MessageSquare, Loader2
} from 'lucide-react'
import { api } from '../../api'

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

export default function MyTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    load()
  }, [filter])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.portalGetMyTickets({
        status: filter === 'open' ? 'open' : filter === 'resolved' ? 'resolved' : undefined,
      })
      setTickets(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openTickets = tickets.filter(t => t.status !== 'Résolu' && t.status !== 'Clos')
  const resolvedTickets = tickets.filter(t => t.status === 'Résolu' || t.status === 'Clos')

  const displayedTickets = filter === 'open' ? openTickets
    : filter === 'resolved' ? resolvedTickets
    : tickets

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mes tickets</h1>
          <p className="text-slate-500 text-sm mt-1">
            {openTickets.length} ouvert(s) • {resolvedTickets.length} résolu(s)
          </p>
        </div>
        <Link
          to="/tickets/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={18} />
          Nouveau ticket
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Tous ({tickets.length})
        </button>
        <button
          onClick={() => setFilter('open')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'open'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          En cours ({openTickets.length})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'resolved'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Résolus ({resolvedTickets.length})
        </button>
      </div>

      {displayedTickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Ticket size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun ticket</p>
          <p className="text-slate-400 text-sm mb-4">
            {filter === 'all' ? 'Créez votre premier ticket' : 'Aucun ticket dans cette catégorie'}
          </p>
          {filter === 'all' && (
            <Link
              to="/tickets/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} />
              Créer un ticket
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketCard({ ticket }) {
  const isResolved = ticket.status === 'Résolu' || ticket.status === 'Clos'

  const priorityColors = {
    'Urgente': 'bg-red-100 text-red-700',
    'Haute': 'bg-orange-100 text-orange-700',
    'Moyenne': 'bg-yellow-100 text-yellow-700',
    'Basse': 'bg-slate-100 text-slate-600',
  }

  const statusColors = {
    'Ouvert': 'bg-blue-100 text-blue-700',
    'En cours': 'bg-amber-100 text-amber-700',
    'En attente client': 'bg-purple-100 text-purple-700',
    'Résolu': 'bg-green-100 text-green-700',
    'Clos': 'bg-slate-100 text-slate-600',
  }

  return (
    <Link
      to={`/portal/tickets/${ticket.id}`}
      className="block bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-5 group"
    >
      <div className="flex justify-between items-start gap-4 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-slate-500">#{ticket.id}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status] || ''}`}>
              {ticket.status}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority] || ''}`}>
              {ticket.priority}
            </span>
            {isResolved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle size={10} />
                Résolu
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
            {ticket.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{ticket.category}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          Créé le {formatDate(ticket.created_at)}
        </span>
        {ticket.assigned_to_name && (
          <span>Assigné à <strong className="text-slate-700">{ticket.assigned_to_name}</strong></span>
        )}
        {isResolved && ticket.resolved_at && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle size={12} />
            Résolu le {formatDate(ticket.resolved_at)}
          </span>
        )}
      </div>
    </Link>
  )
}