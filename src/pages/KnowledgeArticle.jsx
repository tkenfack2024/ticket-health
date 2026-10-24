import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft, Edit, Trash2, Copy, Check, BookOpen, AlertTriangle,
  Eye, ThumbsUp, ThumbsDown, Clock, User, Link as LinkIcon, History
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  slate: 'bg-slate-100 text-slate-600',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

export default function KnowledgeArticle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [voting, setVoting] = useState(false)
  const [canWrite, setCanWrite] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [data, perms] = await Promise.all([
        api.get(`/api/kb/articles/${id}`),
        api.get('/api/kb/my-permissions'),
      ])
      setArticle(data)
      setCanWrite((perms.permissions || []).includes('kb.write'))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleVote = async (helpful) => {
    setVoting(true)
    try {
      await api.post(`/api/kb/articles/${id}/vote`, { helpful })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setVoting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cet article ? Cette action est irréversible.')) return
    try {
      await api.delete(`/api/kb/articles/${id}`)
      navigate('/knowledge')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement de l'article...</div>

  if (error && !article) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
        <Link to="/knowledge" className="inline-block mt-4 text-blue-600 hover:underline">
          ← Retour à la base de connaissances
        </Link>
      </div>
    )
  }

  if (!article) return null

  const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate
  const canEdit = isAdmin || article.author_id === user?.id || canWrite
  const canDelete = isAdmin || article.author_id === user?.id
  const userVote = article.user_vote

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/knowledge" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={18} />
        Retour à la base de connaissances
      </Link>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {article.category_name && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                    {article.category_name}
                  </span>
                )}
                {article.is_known_error === 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                    <AlertTriangle size={11} />
                    Erreur connue
                  </span>
                )}
                {article.status === 'draft' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                    Brouillon
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-slate-800 mb-2">{article.title}</h1>

              {article.summary && (
                <p className="text-slate-500 italic">{article.summary}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyLink}
                title="Copier le lien"
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
              {canEdit && (
                <Link
                  to={`/knowledge/${article.id}/edit`}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                >
                  <Edit size={16} />
                  Modifier
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              )}
            </div>
          </div>

          {/* Métadonnées */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <User size={14} />
              {article.author_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Créé le {formatDate(article.created_at)}
            </span>
            {article.updated_at && (
              <span className="flex items-center gap-1">
                <Edit size={14} />
                Modifié le {formatDate(article.updated_at)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {article.views} vue{article.views > 1 ? 's' : ''}
            </span>
          </div>

          {/* Tags */}
          {article.tags && (
            <div className="flex flex-wrap gap-2 mt-3">
              {article.tags.split(',').map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Workaround (KEDB) */}
        {article.is_known_error === 1 && article.workaround && (
          <div className="p-6 bg-orange-50 border-b border-orange-200">
            <h2 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              Workaround / Solution temporaire
            </h2>
            <p className="text-sm text-orange-800 whitespace-pre-line">
              {article.workaround}
            </p>
          </div>
        )}

        {/* Contenu Markdown */}
        <div className="p-6 markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>

        {/* Votes */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-700">
              Cette solution vous a-t-elle aidé ?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVote(true)}
                disabled={voting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  userVote === 1
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-green-50 hover:border-green-300'
                }`}
              >
                <ThumbsUp size={16} />
                Oui ({article.helpful_yes})
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={voting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  userVote === 0
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:border-red-300'
                }`}
              >
                <ThumbsDown size={16} />
                Non ({article.helpful_no})
              </button>
            </div>
          </div>
        </div>

        {/* Tickets liés */}
        {article.linked_tickets && article.linked_tickets.length > 0 && (
          <div className="p-6 border-t border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <LinkIcon size={18} />
              Tickets liés ({article.linked_tickets.length})
            </h2>
            <div className="space-y-2">
              {article.linked_tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                      #{ticket.id}
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {ticket.title}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700">
                      {ticket.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Historique */}
        {article.history && article.history.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
              <History size={16} />
              Historique des modifications ({article.history.length})
            </h2>
            <div className="space-y-1 text-xs text-slate-600">
              {article.history.map((h) => (
                <div key={h.id} className="flex justify-between">
                  <span>Modifié par <strong>{h.changed_by_name}</strong></span>
                  <span className="text-slate-400">{formatDate(h.changed_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}