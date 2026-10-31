// src/pages/admin/Banners.jsx
import { useState, useEffect } from 'react'
import {
  Megaphone, Plus, Pencil, Trash2, Power, X, Loader2,
  Info, CheckCircle, AlertTriangle, Zap, Calendar,
} from 'lucide-react'
import { api } from '../../api'

const VARIANT_OPTIONS = [
  { id: 'info', label: 'Info (cyan)', icon: Info, badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { id: 'success', label: 'Succès (vert)', icon: CheckCircle, badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'warning', label: 'Avertissement (ambre)', icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'danger', label: 'Danger (rouge)', icon: AlertTriangle, badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'fluo', label: 'Fluo (magenta néon)', icon: Zap, badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400' },
]

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

export default function AdminBanners() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.getAllBanners()
      setBanners(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (banner) => {
    try {
      await api.toggleBanner(banner.id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (banner) => {
    if (!confirm(`Supprimer la bannière "${banner.title}" ?`)) return
    try {
      await api.deleteBanner(banner.id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Megaphone size={22} className="text-blue-600 dark:text-blue-400" />
            Bannières système
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {banners.length} bannière(s) — Affichées en haut de l'écran des utilisateurs autorisés
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nouvelle bannière
        </button>
      </div>

      <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">💡 Comment ça marche ?</p>
        <ul className="text-blue-800 dark:text-blue-400 text-xs space-y-1 list-disc list-inside">
          <li>La bannière s'affiche <strong>en haut de l'écran</strong> pour les utilisateurs ayant la permission <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">notifications.banner.read</code>.</li>
          <li>Elle <strong>disparaît automatiquement</strong> après <strong>duration_seconds</strong> (mettre 0 = reste jusqu'à fermeture manuelle).</li>
          <li>Les variantes définissent la <strong>couleur et l'intensité du glow</strong> (la variante "Fluo" est encore plus fluorescente).</li>
          <li>Les dates <strong>starts_at</strong> / <strong>ends_at</strong> permettent de programmer l'affichage.</li>
        </ul>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {banners.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Megaphone size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucune bannière</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">Créez votre première bannière pour informer vos utilisateurs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <BannerCard
              key={banner.id}
              banner={banner}
              onEdit={() => { setEditing(banner); setShowModal(true) }}
              onToggle={() => handleToggle(banner)}
              onDelete={() => handleDelete(banner)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <BannerModal
          banner={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSuccess={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ============ CARTE ============

function BannerCard({ banner, onEdit, onToggle, onDelete }) {
  const variantCfg = VARIANT_OPTIONS.find(v => v.id === banner.variant) || VARIANT_OPTIONS[0]
  const VariantIcon = variantCfg.icon
  const isActive = Number(banner.active) === 1

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex flex-col gap-3 ${
      isActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700 opacity-60'
    }`}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">#{banner.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${variantCfg.badge}`}>
              <VariantIcon size={11} />
              {variantCfg.label}
            </span>
            {!isActive && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                Désactivée
              </span>
            )}
            {banner.duration_seconds === 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Manuelle
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{banner.title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-line">{banner.message}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onToggle}
            className={`p-1.5 rounded ${isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
            title={isActive ? 'Désactiver' : 'Activer'}
          >
            <Power size={16} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="Modifier"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
        <span>Durée : {banner.duration_seconds > 0 ? `${banner.duration_seconds}s` : 'Manuelle'}</span>
        {banner.starts_at && <span className="flex items-center gap-1"><Calendar size={11} /> Début : {formatDate(banner.starts_at)}</span>}
        {banner.ends_at && <span className="flex items-center gap-1"><Calendar size={11} /> Fin : {formatDate(banner.ends_at)}</span>}
        <span>Par {banner.created_by_name || '—'}</span>
        <span>Créée le {formatDate(banner.created_at)}</span>
      </div>
    </div>
  )
}

// ============ MODAL CRÉATION / ÉDITION ============

function BannerModal({ banner, onClose, onSuccess }) {
  const isEdit = !!banner
  const [form, setForm] = useState({
    title: banner?.title || '',
    message: banner?.message || '',
    variant: banner?.variant || 'info',
    duration_seconds: banner?.duration_seconds ?? 10,
    starts_at: banner?.starts_at || '',
    ends_at: banner?.ends_at || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        duration_seconds: parseInt(form.duration_seconds) || 0,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }
      if (isEdit) {
        await api.updateBanner(banner.id, payload)
      } else {
        await api.createBanner(payload)
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            {isEdit ? `Modifier "${banner.title}"` : 'Nouvelle bannière'}
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Titre *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Maintenance prévue ce soir"
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Message *
            </label>
            <textarea
              required
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Décrivez l'information à transmettre..."
              className="input-dark resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Variante (couleur + intensité du glow)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {VARIANT_OPTIONS.map((v) => {
                const Icon = v.icon
                const isActive = form.variant === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setForm({ ...form, variant: v.id })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                      isActive
                        ? `${v.badge} border-current`
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    {v.label.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Durée d'affichage (secondes)
            </label>
            <input
              type="number"
              min="0"
              value={form.duration_seconds}
              onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
              className="input-dark"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mettre <strong>0</strong> pour que la bannière reste affichée jusqu'à ce que l'utilisateur la ferme manuellement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Début d'affichage (optionnel)
              </label>
              <input
                type="datetime-local"
                value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fin d'affichage (optionnel)
              </label>
              <input
                type="datetime-local"
                value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer la bannière'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}