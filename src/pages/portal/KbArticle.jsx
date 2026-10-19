import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Eye, ThumbsUp, ThumbsDown, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../../api'

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}

export default function PortalKbArticle() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.portalGetKbArticle(id)
      setArticle(data)
      setError(null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleVote = async (helpful) => {
    setVoting(true)
    try {
      await api.portalVoteKb(id, helpful)
      await load()
    } catch (err) { alert(err.message) } finally { setVoting(false) }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement...</div>
  if (error && !article) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>
  if (!article) return null

  const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/portal/kb" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} />Retour à la base de connaissances
      </Link>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {article.category_name && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{article.category_name}</span>}
            {article.is_known_error === 1 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle size={11} />Erreur connue</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{article.title}</h1>
          {article.summary && <p className="text-slate-500 dark:text-slate-400 italic">{article.summary}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400 mt-4">
            <span className="flex items-center gap-1"><Clock size={14} />{formatDate(article.created_at)}</span>
            <span className="flex items-center gap-1"><Eye size={14} />{article.views} vue{article.views > 1 ? 's' : ''}</span>
          </div>
          {article.tags && (
            <div className="flex flex-wrap gap-2 mt-3">
              {article.tags.split(',').map((tag, i) => <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">#{tag.trim()}</span>)}
            </div>
          )}
        </div>

        {article.is_known_error === 1 && article.workaround && (
          <div className="p-6 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
            <h2 className="font-semibold text-orange-900 dark:text-orange-300 mb-2 flex items-center gap-2"><AlertTriangle size={18} />Workaround</h2>
            <p className="text-sm text-orange-800 dark:text-orange-400 whitespace-pre-line">{article.workaround}</p>
          </div>
        )}

        <div className="p-6 markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cette solution vous a-t-elle aidé ?</p>
            <div className="flex items-center gap-2">
              <button onClick={() => handleVote(true)} disabled={voting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  article.user_vote === 1 ? 'bg-green-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}>
                <ThumbsUp size={16} />Oui ({article.helpful_yes})
              </button>
              <button onClick={() => handleVote(false)} disabled={voting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  article.user_vote === 0 ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}>
                <ThumbsDown size={16} />Non ({article.helpful_no})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}