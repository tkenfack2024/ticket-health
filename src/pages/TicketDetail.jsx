import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, User, Loader2, Archive, Package, Hash, MapPin } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import SlaPanel from '../components/SlaPanel'
import KbSuggestions from '../components/KbSuggestions'
import IncidentClassification from '../components/IncidentClassification'
import TicketCis from '../components/TicketCis'

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [ticket, setTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [sending, setSending] = useState(false)

  const [newComment, setNewComment] = useState('')
  const [author, setAuthor] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const promises = [
        api.getTicket(id),
        api.getComments(id),
      ]
      if (isAdmin) promises.push(api.adminGetUsers())

      const [ticketData, commentsData, usersData] = await Promise.all(promises)
      setTicket(ticketData)
      setComments(commentsData || [])
      if (usersData) setUsers(usersData)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id, isAdmin])

  const handleStatusChange = async (newStatus) => {
    setUpdating(true)
    try {
      await api.updateTicket(id, { status: newStatus })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleAssign = async (email) => {
    setUpdating(true)
    try {
      await api.updateTicket(id, { assignee: email || '-' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleArchive = async () => {
    if (!confirm('Archiver ce ticket ?\n\nIl sera déplacé dans la section Archive.')) return
    try {
      await api.archiveTicket(id)
      navigate('/tickets')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSending(true)
    try {
      await api.addComment(id, {
        author: author.trim() || 'Utilisateur',
        text: newComment.trim(),
      })
      setNewComment('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement du ticket...</div>

  if (error && !ticket) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
        <Link to="/tickets" className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline">
          ← Retour aux tickets
        </Link>
      </div>
    )
  }

  if (!ticket) return null

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/tickets" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} />
        Retour aux tickets
      </Link>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{ticket.title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Ticket #{ticket.id} • Créé le {ticket.created_at}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                ticket.priority === 'Urgente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                ticket.priority === 'Haute' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                ticket.priority === 'Moyenne' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {ticket.priority}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                ticket.status === 'Ouvert' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                ticket.status === 'En cours' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                ticket.status === 'En attente client' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {ticket.status}
              </span>
              {isAdmin && !ticket.archived && (
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                >
                  <Archive size={14} />
                  Archiver
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Catégorie</p>
            <p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.category}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Créé par</p>
            <p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.creator}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assigné à</p>
            {isAdmin ? (
              <select
                value={ticket.assignee === '-' ? '' : ticket.assignee}
                onChange={(e) => handleAssign(e.target.value)}
                disabled={updating}
                className="mt-1 w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">— Non assigné —</option>
                {users.filter(u => u.active).map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            ) : (
              <p className="font-medium text-slate-800 dark:text-slate-100 mt-1">{ticket.assignee}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Description</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {ticket.description || 'Aucune description fournie.'}
          </p>
        </div>

        {/* Asset lié */}
        {ticket.asset_id && ticket.asset_name && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Package size={18} className="text-blue-600 dark:text-blue-400" />
              Équipement / Logiciel concerné
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase mb-2 ${
                    ticket.asset_type === 'hardware'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {ticket.asset_type === 'hardware' ? '🔧 Hardware' : '💻 Software'}
                  </span>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{ticket.asset_name}</h3>
                  {ticket.asset_category && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{ticket.asset_category}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                {ticket.asset_type === 'hardware' && ticket.asset_serial_number && (
                  <div className="flex items-start gap-2">
                    <Hash size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">N° de série</p>
                      <p className="font-mono text-sm font-medium text-slate-800 dark:text-slate-100">
                        {ticket.asset_serial_number}
                      </p>
                    </div>
                  </div>
                )}
                {ticket.asset_type === 'hardware' && (ticket.asset_brand || ticket.asset_model) && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Marque / Modèle</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {[ticket.asset_brand, ticket.asset_model].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {ticket.asset_type === 'software' && ticket.asset_editor && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Éditeur</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ticket.asset_editor}</p>
                  </div>
                )}
                {ticket.asset_type === 'software' && ticket.asset_version && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Version</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">v{ticket.asset_version}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SLA */}
        <SlaPanel ticket={ticket} />

        {/* Configuration Items */}
        <TicketCis ticketId={parseInt(id)} isAdmin={isAdmin} />

        {/* Suggestions KB */}
        <KbSuggestions ticketId={parseInt(id)} ticketLoaded={!!ticket} />

        {/* Classification incidents */}
        <IncidentClassification ticket={ticket} onUpdate={load} isAdmin={isAdmin} />

        {/* Actions statut */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Changer le statut</h2>
          <div className="flex flex-wrap gap-2">
            {['Ouvert', 'En cours', 'En attente client', 'Résolu'].map((s) => (
              <button
                key={s}
                disabled={updating || ticket.status === s}
                onClick={() => handleStatusChange(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  ticket.status === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {updating && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Mise à jour...</p>}
        </div>

        {/* Commentaires */}
        <div className="p-6">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <MessageSquare size={18} />
            Commentaires ({(comments || []).length})
          </h2>

          {(comments || []).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Aucun commentaire pour le moment. Soyez le premier !
            </p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{c.author}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{c.created_at}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddComment} className="space-y-3">
            <input
              type="text"
              placeholder="Votre nom (optionnel)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex gap-3">
              <textarea
                rows={2}
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={sending || !newComment.trim()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 self-end disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending && <Loader2 size={16} className="animate-spin" />}
                Envoyer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}