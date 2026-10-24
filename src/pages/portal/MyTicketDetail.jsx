import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, User, Loader2, CheckCircle, BookOpen } from 'lucide-react'
import { api } from '../../api'

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return d }
}

export default function MyTicketDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      setLoading(true)
      const result = await api.portalGetMyTicket(id)
      setData(result)
      setError(null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    try {
      await api.portalAddComment(id, newComment.trim())
      setNewComment('')
      await load()
    } catch (err) { alert(err.message) } finally { setSending(false) }
  }

  const handleConfirmResolved = async () => {
    if (!confirm('Confirmer que votre problème est résolu ?')) return
    try {
      await api.portalConfirmResolved(id)
      await load()
    } catch (err) { alert(err.message) }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement...</div>
  if (error && !data) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>
  if (!data) return null

  const { ticket, comments, kb_suggestions } = data
  const priorityColors = { Urgente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', Haute: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', Moyenne: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', Basse: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
  const statusColors = { Ouvert: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', 'En cours': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', 'En attente client': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', Résolu: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', Clos: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
  const isResolved = ticket.status === 'Résolu'
  const isClosed = ticket.status === 'Clos'

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/portal" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} />Retour à mes tickets
      </Link>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{ticket.title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ticket #{ticket.id} • Créé le {formatDate(ticket.created_at)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[ticket.status] || ''}`}>{ticket.status}</span>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Catégorie</p><p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.category}</p></div>
          <div><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assigné à</p><p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.assigned_to_name || 'Non assigné'}</p></div>
          {ticket.asset_name && <div><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Équipement</p><p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.asset_name}</p></div>}
        </div>

        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Description</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{ticket.description || 'Aucune description.'}</p>
        </div>

        {isResolved && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-300">Le technicien a marqué ce ticket comme résolu</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Le problème est-il résolu pour vous ?</p>
                <button onClick={handleConfirmResolved} className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">✓ Oui, confirmer la résolution</button>
              </div>
            </div>
          </div>
        )}

        {kb_suggestions && kb_suggestions.length > 0 && !isClosed && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/10">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><BookOpen size={18} className="text-blue-600 dark:text-blue-400" />Articles qui pourraient vous aider</h2>
            <div className="space-y-2">
              {kb_suggestions.map((article) => (
                <Link key={article.id} to={`/portal/kb/${article.id}`} className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 p-3 transition-colors">
                  <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{article.title}</p>
                  {article.category_name && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{article.category_name}</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><MessageSquare size={18} />Échanges ({comments.length})</h2>
          {comments.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Aucun échange pour le moment.</p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0"><User size={16} className="text-blue-600 dark:text-blue-400" /></div>
                  <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{c.author}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isClosed && (
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea rows={3} placeholder="Ajouter un commentaire..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="input-dark resize-none" />
              <button type="submit" disabled={sending || !newComment.trim()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {sending && <Loader2 size={16} className="animate-spin" />}Envoyer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}