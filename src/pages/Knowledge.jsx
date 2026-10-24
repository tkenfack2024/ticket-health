import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, BookOpen, AlertTriangle, Eye, ThumbsUp } from 'lucide-react'
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

const PAGE_SIZE = 20

export default function Knowledge() {
  const { user } = useAuth()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [canWrite, setCanWrite] = useState(false)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterKnownError, setFilterKnownError] = useState(false)
  const [page, setPage] = useState(0)

  const load = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (filterCategory) params.append('category_id', filterCategory)
      if (filterKnownError) params.append('known_error', 'true')
      params.append('limit', PAGE_SIZE)
      params.append('offset', page * PAGE_SIZE)

      const [data, cats, perms] = await Promise.all([
        api.get('/api/kb/articles?' + params.toString()),
        api.get('/api/kb/categories'),
        api.get('/api/kb/my-permissions'),
      ])
      
      console.log('DEBUG - Permissions reçues:', perms)
      
      setArticles(data.articles || [])
      setTotal(data.total || 0)
      setCategories(cats || [])
      setCanWrite((perms.permissions || []).includes('kb.write'))
      setError(null)
    } catch (err) {
      console.error('Erreur chargement KB:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [search, filterCategory, filterKnownError, page])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={26} className="text-blue-600" />
            Base de connaissances
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {total} article{total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <Link
            to="/knowledge/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={18} />
            Nouvel article
          </Link>
        )}
      </div>

      {/* Barre de recherche + filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(0) }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.article_count})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={filterKnownError}
              onChange={(e) => { setFilterKnownError(e.target.checked); setPage(0) }}
              className="w-4 h-4"
            />
            <AlertTriangle size={14} className="text-orange-500" />
            Erreurs connues
          </label>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Rechercher
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Liste des articles */}
      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BookOpen size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun article trouvé</p>
          <p className="text-slate-400 text-sm">
            {search || filterCategory || filterKnownError
              ? 'Essayez de modifier vos filtres.'
              : canWrite
              ? 'Créez votre premier article !'
              : "Aucun article n'est encore disponible."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm">
              <p className="text-slate-500">
                Page {page + 1} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ArticleCard({ article }) {
  const colorClass = COLOR_CLASSES[article.category_color] || COLOR_CLASSES.slate

  return (
    <Link
      to={`/knowledge/${article.id}`}
      className="group bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1">
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

        <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
          {article.title}
        </h3>

        {article.summary && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-3">
            {article.summary}
          </p>
        )}

        {article.tags && (
          <div className="flex flex-wrap gap-1 mb-3">
            {article.tags.split(',').slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {article.views}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp size={12} />
            {article.helpful_yes}
          </span>
        </div>
        <span>{article.author_name}</span>
      </div>
    </Link>
  )
}