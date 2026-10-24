import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft, Save, X, Loader2, AlertTriangle, Eye, Edit3, Split
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function KnowledgeEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const isEdit = !!id

  const [categories, setCategories] = useState([])
  const [canPublish, setCanPublish] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('split')

  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    category_id: '',
    tags: '',
    status: 'draft',
    is_known_error: false,
    workaround: '',
  })

  // Charger catégories + permissions
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [cats, perms] = await Promise.all([
          api.get('/api/kb/categories'),
          api.get('/api/kb/my-permissions'),
        ])
        console.log('CATÉGORIES CHARGÉES :', cats)
        setCategories(cats || [])
        setCanPublish((perms.permissions || []).includes('kb.publish'))
      } catch (err) {
        console.error('Erreur chargement catégories :', err)
      }
    }
    loadMeta()
  }, [])

  // Charger l'article si édition
  useEffect(() => {
    if (!isEdit) {
      setLoading(false)
      return
    }

    api.get(`/api/kb/articles/${id}`)
      .then(article => {
        setForm({
          title: article.title || '',
          summary: article.summary || '',
          content: article.content || '',
          category_id: article.category_id || '',
          tags: article.tags || '',
          status: article.status || 'draft',
          is_known_error: article.is_known_error === 1,
          workaround: article.workaround || '',
        })
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Le titre est obligatoire')
      return
    }
    if (!form.content.trim()) {
      setError('Le contenu est obligatoire')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
      }

      let result
      if (isEdit) {
        result = await api.patch(`/api/kb/articles/${id}`, payload)
      } else {
        result = await api.post('/api/kb/articles', payload)
      }

      navigate(`/knowledge/${result.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length
  const charCount = form.content.length

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <Link to="/knowledge" className="flex items-center gap-2 text-slate-500 hover:text-slate-700">
          <ArrowLeft size={18} />
          Retour
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Enregistrer' : 'Créer l\'article'}
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {isEdit ? 'Modifier l\'article' : 'Nouvel article'}
      </h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Métadonnées principales */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Titre *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Comment réinitialiser un mot de passe Windows"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Résumé
            </label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Résumé court (1 phrase)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Catégorie
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Aucune —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {categories.length} catégorie{categories.length > 1 ? 's' : ''} disponible{categories.length > 1 ? 's' : ''}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tags (séparés par virgule)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="windows, mot de passe, reset"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Statut
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Brouillon</option>
                <option value="published" disabled={!canPublish}>
                  {canPublish ? 'Publié' : 'Publié (permission requise)'}
                </option>
                <option value="archived">Archivé</option>
              </select>
              {!canPublish && (
                <p className="text-xs text-slate-500 mt-1">
                  Vos articles seront enregistrés en brouillon (permission "Publier" requise).
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                KEDB
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.is_known_error}
                  onChange={(e) => setForm({ ...form, is_known_error: e.target.checked })}
                  className="w-4 h-4"
                />
                <AlertTriangle size={16} className="text-orange-500" />
                <span className="text-sm">Erreur connue (KEDB)</span>
              </label>
            </div>
          </div>

          {form.is_known_error && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Workaround / Solution temporaire
              </label>
              <textarea
                rows={3}
                value={form.workaround}
                onChange={(e) => setForm({ ...form, workaround: e.target.value })}
                placeholder="Décrivez la solution temporaire en attendant un correctif..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-slate-400 placeholder:italic"
              />
            </div>
          )}
        </div>

        {/* Contenu Markdown avec toggle */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Contenu *
              </label>
              <span className="text-xs text-slate-400">
                ({wordCount} mots, {charCount} caractères)
              </span>
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Edit3 size={12} />
                Éditeur
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'split' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Split size={12} />
                Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Eye size={12} />
                Aperçu
              </button>
            </div>
          </div>

          <div className={`flex ${viewMode === 'split' ? 'flex-col md:flex-row' : ''}`}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <textarea
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={`## Contexte\n\nDescription du problème...\n\n## Étapes\n\n1. Première étape\n2. Deuxième étape\n\n> Note importante`}
                className={`font-mono text-sm p-4 focus:outline-none resize-none placeholder:text-slate-400 placeholder:italic ${
                  viewMode === 'split' ? 'w-full md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200' : 'w-full'
                }`}
                style={{ minHeight: '400px' }}
              />
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={`p-4 markdown-content overflow-auto ${
                viewMode === 'split' ? 'w-full md:w-1/2 bg-slate-50' : 'w-full'
              }`}
              style={{ minHeight: '400px', maxHeight: '600px' }}>
                {form.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {form.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-slate-400 italic text-sm">
                    L'aperçu apparaîtra ici au fur et à mesure de votre saisie...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Enregistrer les modifications' : 'Créer l\'article'}
          </button>
          <Link
            to="/knowledge"
            className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
          >
            <X size={16} />
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}