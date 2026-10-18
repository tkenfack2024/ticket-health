import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, User, Loader2, CheckCircle, BookOpen, ThumbsUp, ThumbsDown } from 'lucide-react'
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

export default function MyTicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  const load = async () => {
    try {
      setLoading(true)
      const result = await api.portalGetMyTicket(id)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSending(true)
    try {
      await api.portalAddComment(id, newComment.trim())
      setNewComment('')
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleConfirmResolved = async () => {
    if (!confirm('Confirmer que votre problème est résolu ?')) return
    try {
      await api.portalConfirmResolved(id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>
  if (error && !data) return <div className="p-8 text-red-600">{error}</div>
  if (!data) return null

  const { ticket, comments, kb_suggestions } = data

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

  const isResolved = ticket.status === 'Résolu'
  const isClosed = ticket.status === 'Clos'

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/portal" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={18} />
        Retour à mes tickets
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{ticket.title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                Ticket #{ticket.id} • Créé le {formatDate(ticket.created_at)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[ticket.priority] || ''}`}>
                {ticket.priority}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[ticket.status] || ''}`}>
                {ticket.status}
              </span>
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200 bg-slate-50">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Catégorie</p>
            <p className="font-medium text-slate-800 mt-1">{ticket.category}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Assigné à</p>
            <p className="font-medium text-slate-800 mt-1">{ticket.assigned_to_name || 'Non assigné'}</p>
          </div>
          {ticket.asset_name && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Équipement</p>
              <p className="font-medium text-slate-800 mt-1">{ticket.asset_name}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-3">Description</h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">
            {ticket.description || 'Aucune description.'}
          </p>
        </div>

        {/* Confirmation résolution */}
        {isResolved && (
          <div className="p-6 border-b border-slate-200 bg-green-50">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-green-900">Le technicien a marqué ce ticket comme résolu</p>
                <p className="text-sm text-green-700 mt-1">
                  Le problème est-il résolu pour vous ?
                </p>
                <button
                  onClick={handleConfirmResolved}
                  className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  ✓ Oui, confirmer la résolution
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Articles KB suggérés */}
        {kb_suggestions && kb_suggestions.length > 0 && !isClosed && (
          <div className="p-6 border-b border-slate-200 bg-blue-50/30">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              Articles qui pourraient vous aider
            </h2>
            <div className="space-y-2">
              {kb_suggestions.map((article) => (
                <Link
                  key={article.id}
                  to={`/portal/kb/${article.id}`}
                  className="block bg-white rounded-lg border border-slate-200 hover:border-blue-300 p-3 transition-colors"
                >
                  <p className="font-medium text-slate-800 text-sm">{article.title}</p>
                  {article.category_name && (
                    <p className="text-xs text-slate-500 mt-1">{article.category_name}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Commentaires */}
        <div className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <MessageSquare size={18} />
            Échanges ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-sm text-slate-500 mb-6">
              Aucun échange pour le moment.
            </p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-slate-800">{c.author}</span>
                      <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ajouter un commentaire */}
          {!isClosed && (
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                rows={3}
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={sending || !newComment.trim()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {sending && <Loader2 size={16} className="animate-spin" />}
                Envoyer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}