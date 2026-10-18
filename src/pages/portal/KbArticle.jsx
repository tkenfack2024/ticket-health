import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Eye, ThumbsUp, ThumbsDown, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../../api'

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  slate: 'bg-slate-100 text-slate-600',
}

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return d }
}

export default function PortalKbArticle() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.portalGetKbArticle(id)
      setArticle(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (helpful) => {
    setVoting(true)
    try {
      await api.portalVoteKb(id, helpful)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setVoting(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>
  if (error && !article) return <div className="p-8 text-red-600">{error}</div>
  if (!article) return null

  const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/portal/kb" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={18} />
        Retour à la base de connaissances
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
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
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-2">{article.title}</h1>

          {article.summary && (
            <p className="text-slate-500 italic">{article.summary}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-4">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDate(article.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {article.views} vue{article.views > 1 ? 's' : ''}
            </span>
          </div>

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

        {/* Workaround KEDB */}
        {article.is_known_error === 1 && article.workaround && (
          <div className="p-6 bg-orange-50 border-b border-orange-200">
            <h2 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              Workaround
            </h2>
            <p className="text-sm text-orange-800 whitespace-pre-line">
              {article.workaround}
            </p>
          </div>
        )}

        {/* Contenu */}
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
                  article.user_vote === 1
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
                  article.user_vote === 0
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
      </div>
    </div>
  )
}