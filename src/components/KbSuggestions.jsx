import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, AlertTriangle, Eye, Link as LinkIcon, Check, Loader2 } from 'lucide-react'
import { api } from '../api'

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function KbSuggestions({ ticketId, ticketLoaded = true }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(null)
  const [linked, setLinked] = useState(new Set())

  useEffect(() => {
    if (!ticketId || !ticketLoaded) return
    api.get(`/api/kb/suggest?ticket_id=${ticketId}`)
      .then(data => { setSuggestions(data || []); setLoading(false) })
      .catch(err => { console.error('Erreur suggestions:', err); setLoading(false) })
  }, [ticketId, ticketLoaded])

  const handleLink = async (articleId) => {
    setLinking(articleId)
    try {
      await api.post(`/api/kb/articles/${articleId}/link-ticket`, { ticket_id: ticketId })
      setLinked(new Set([...linked, articleId]))
    } catch (err) { alert(err.message) } finally { setLinking(null) }
  }

  if (loading) {
    return (
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-slate-400 dark:text-slate-500" />Articles suggérés
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">Recherche en cours...</p>
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/10">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
        <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
        Articles suggérés ({suggestions.length})
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-2">Basé sur le titre et la description</span>
      </h2>

      <div className="space-y-2">
        {suggestions.map((article) => {
          const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate
          const isLinked = linked.has(article.id)
          return (
            <div key={article.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/knowledge/${article.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {article.category_name && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{article.category_name}</span>}
                    {article.is_known_error === 1 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle size={10} />Erreur connue</span>}
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-sm line-clamp-2">{article.title}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Eye size={11} />{article.views} vue{article.views > 1 ? 's' : ''}</span>
                  </div>
                </Link>
                <button onClick={() => handleLink(article.id)} disabled={linking === article.id || isLinked}
                  title={isLinked ? 'Déjà lié' : 'Lier cet article au ticket'}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                    isLinked ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400'
                  }`}>
                  {linking === article.id ? <Loader2 size={12} className="animate-spin" /> : isLinked ? <Check size={12} /> : <LinkIcon size={12} />}
                  {isLinked ? 'Lié' : 'Lier'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}