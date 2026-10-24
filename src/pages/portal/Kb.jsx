import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, BookOpen, AlertTriangle, Eye, ThumbsUp } from 'lucide-react'
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

export default function PortalKb() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => { load() }, [search])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.portalGetKb({ search: search || undefined })
      setArticles(data)
      setError(null)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput) }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <BookOpen size={26} className="text-blue-600 dark:text-blue-400" />
          Base de connaissances
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Trouvez des solutions à vos problèmes</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input type="text" placeholder="Rechercher un article..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="input-dark pl-10" />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Rechercher</button>
      </form>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm">Chargement...</div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <BookOpen size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucun article trouvé</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">{search ? 'Essayez un autre mot-clé' : "La base est vide pour l'instant"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article }) {
  const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate
  return (
    <Link to={`/portal/kb/${article.id}`} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all p-5 group">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {article.category_name && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{article.category_name}</span>}
        {article.is_known_error === 1 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle size={10} />Erreur connue</span>}
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">{article.title}</h3>
      {article.summary && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{article.summary}</p>}
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700">
        <span className="flex items-center gap-1"><Eye size={12} />{article.views}</span>
        <span className="flex items-center gap-1"><ThumbsUp size={12} />{article.helpful_yes}</span>
      </div>
    </Link>
  )
}