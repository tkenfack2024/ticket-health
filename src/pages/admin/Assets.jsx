import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, X, Loader2, Search,
  Monitor, Package, Paperclip, Download, Upload, FileSpreadsheet,
} from 'lucide-react'
import { api } from '../../api'

const HARDWARE_STATUSES = ['En service', 'En maintenance', 'En panne', 'Réformé', 'Stock']
const SOFTWARE_STATUSES = ['Active', 'Expirée', 'En test', 'Archivée']

const STATUS_COLORS = {
  'En service': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'En maintenance': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'En panne': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Réformé': 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  'Stock': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Active': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Expirée': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'En test': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Archivée': 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
}

export default function AdminAssets() {
  const [activeType, setActiveType] = useState('hardware')
  const [assets, setAssets] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filesAsset, setFilesAsset] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [assetsData, usersData] = await Promise.all([
        api.adminGetAssets({ type: activeType, search: search || undefined }),
        api.adminGetUsers(),
      ])
      setAssets(assetsData)
      setUsers(usersData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeType, search])

  const handleDelete = async (asset) => {
    if (!confirm(`Supprimer "${asset.name}" ?`)) return
    try {
      await api.adminDeleteAsset(asset.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Assets</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gestion des équipements et logiciels</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
            <FileSpreadsheet size={16} />
            Importer CSV
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus size={16} />
            Nouvel asset
          </button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveType('hardware')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-medium transition-colors ${
            activeType === 'hardware'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Monitor size={16} />
          Hardware
        </button>
        <button
          onClick={() => setActiveType('software')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-medium transition-colors ${
            activeType === 'software'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package size={16} />
          Software
        </button>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </form>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm">Chargement...</div>
      ) : assets.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
          Aucun {activeType === 'hardware' ? 'équipement' : 'logiciel'} enregistré.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Nom</th>
                {activeType === 'hardware' && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Marque / Modèle</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">N° série</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Localisation</th>
                  </>
                )}
                {activeType === 'software' && (
                  <>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Éditeur</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Version</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Licences</th>
                  </>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Assigné à</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{asset.name}</p>
                    {asset.category && <p className="text-xs text-slate-500 dark:text-slate-400">{asset.category}</p>}
                  </td>
                  {activeType === 'hardware' && (
                    <>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {[asset.brand, asset.model].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono">{asset.serial_number || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.location || '-'}</td>
                    </>
                  )}
                  {activeType === 'software' && (
                    <>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.editor || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.version || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.license_count ? `${asset.license_count} licence(s)` : '-'}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {asset.assigned_to_name || <span className="text-slate-400 dark:text-slate-500">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setFilesAsset(asset)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded" title="Fichiers">
                        <Paperclip size={16} />
                      </button>
                      <button onClick={() => { setEditing(asset); setShowModal(true) }} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Modifier">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(asset)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AssetModal
          asset={editing}
          users={users}
          defaultType={activeType}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSuccess={(createdType) => {
            setShowModal(false)
            setEditing(null)
            if (createdType && createdType !== activeType) setActiveType(createdType)
            else load()
          }}
        />
      )}
      {filesAsset && <AssetFilesModal asset={filesAsset} onClose={() => setFilesAsset(null)} />}
      {showImportModal && <ImportCSVModal onClose={() => setShowImportModal(false)} onSuccess={() => { setShowImportModal(false); load() }} />}
    </div>
  )
}

// ============ MODAL ASSET ============
function AssetModal({ asset, users, defaultType, onClose, onSuccess }) {
  const isEdit = !!asset
  const [form, setForm] = useState({
    type: asset?.type || defaultType,
    name: asset?.name || '', category: asset?.category || '',
    brand: asset?.brand || '', model: asset?.model || '',
    serial_number: asset?.serial_number || '', location: asset?.location || '',
    assigned_to: asset?.assigned_to || '',
    status: asset?.status || (defaultType === 'hardware' ? 'En service' : 'Active'),
    purchase_date: asset?.purchase_date || '', warranty_end: asset?.warranty_end || '',
    editor: asset?.editor || '', version: asset?.version || '',
    license_key: asset?.license_key || '', license_expires_at: asset?.license_expires_at || '',
    license_count: asset?.license_count || '', notes: asset?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const isHardware = form.type === 'hardware'
  const statuses = isHardware ? HARDWARE_STATUSES : SOFTWARE_STATUSES

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = { ...form }
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      if (payload.assigned_to === null) delete payload.assigned_to
      if (isEdit) {
        await api.adminUpdateAsset(asset.id, payload)
        onSuccess()
      } else {
        await api.adminCreateAsset(payload)
        onSuccess(form.type)
      }
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
            {isEdit ? `Modifier "${asset.name}"` : `Nouveau ${isHardware ? 'hardware' : 'software'}`}
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, type: 'hardware', status: 'En service' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    form.type === 'hardware'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                  }`}>
                  <Monitor size={16} /> Hardware
                </button>
                <button type="button" onClick={() => setForm({ ...form, type: 'software', status: 'Active' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    form.type === 'software'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                  }`}>
                  <Package size={16} /> Software
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-dark" />
            </div>
          </div>

          {isHardware && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marque</label>
                  <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modèle</label>
                  <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input-dark" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° de série</label>
                  <input type="text" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="input-dark font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localisation</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-dark" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date d'achat</label>
                  <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fin de garantie</label>
                  <input type="date" value={form.warranty_end} onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} className="input-dark" />
                </div>
              </div>
            </>
          )}

          {!isHardware && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Éditeur</label>
                  <input type="text" value={form.editor} onChange={(e) => setForm({ ...form, editor: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Version</label>
                  <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="input-dark" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clé de licence</label>
                <input type="text" value={form.license_key} onChange={(e) => setForm({ ...form, license_key: e.target.value })} className="input-dark font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiration licence</label>
                  <input type="date" value={form.license_expires_at} onChange={(e) => setForm({ ...form, license_expires_at: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre de licences</label>
                  <input type="number" min="1" value={form.license_count} onChange={(e) => setForm({ ...form, license_count: e.target.value })} className="input-dark" />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assigné à</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input-dark">
                <option value="">— Non assigné —</option>
                {users.filter(u => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-dark">
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-dark resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODAL FICHIERS ============
function AssetFilesModal({ asset, onClose }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.getAssetFiles(asset.id)
      setFiles(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [asset.id])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Fichier trop volumineux (max 5 MB)'); return }
    setUploading(true)
    setError(null)
    try {
      await api.uploadAssetFile(asset.id, file)
      await load()
      e.target.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Supprimer "${file.filename}" ?`)) return
    try {
      await api.deleteAssetFile(file.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) return '🖼️'
    if (mimetype === 'application/pdf') return '📄'
    if (mimetype.includes('word')) return '📝'
    if (mimetype.includes('excel') || mimetype === 'text/csv') return '📊'
    return '📎'
  }

  const handleDownload = (file) => window.open(api.downloadAssetFileUrl(file.id), '_blank')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Fichiers de "{asset.name}"</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{files.length} fichier(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <div className="mb-4">
          <label className={`flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            uploading ? 'border-slate-300 bg-slate-50 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv" onChange={handleUpload} disabled={uploading} />
            {uploading ? (
              <>
                <Loader2 size={24} className="animate-spin text-blue-600" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Upload en cours...</span>
              </>
            ) : (
              <>
                <Upload size={24} className="text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliquez pour uploader un fichier</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">PDF, JPG, PNG, DOCX, XLSX, CSV — Max 5 MB</span>
              </>
            )}
          </label>
        </div>

        {loading ? (
          <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">Chargement...</div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">Aucun fichier pour cet asset.</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimetype)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{file.filename}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(file.size)} • {file.uploaded_at}</p>
                </div>
                <button onClick={() => handleDownload(file)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Télécharger">
                  <Download size={16} />
                </button>
                <button onClick={() => handleDelete(file)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ MODAL IMPORT CSV ============
function ImportCSVModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleDownloadTemplate = () => {
    const headers = ['type', 'name', 'category', 'brand', 'model', 'serial_number', 'location', 'assigned_to_email', 'status', 'purchase_date', 'warranty_end', 'editor', 'version', 'license_key', 'license_expires_at', 'license_count', 'notes']
    const example1 = ['hardware', 'PC Dell Latitude 5520', 'Ordinateur', 'Dell', 'Latitude 5520', 'SN-001', 'Bureau 301', 'admin@healthticket.local', 'En service', '2024-01-15', '2027-01-15', '', '', '', '', '', 'PC portable']
    const example2 = ['software', 'Adobe Acrobat Pro', 'Bureautique', '', '', '', '', 'admin@healthticket.local', 'Active', '', '', 'Adobe', '2024', 'XXXX-XXXX', '2025-12-31', '25', 'Licence annuelle']
    const csvContent = [headers.join(','), example1.join(','), example2.join(',')].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modele-import-assets.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.importAssetsCSV(file)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Importer des assets depuis un CSV</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {!result ? (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">📋 Comment ça marche ?</p>
              <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Téléchargez le modèle CSV</li>
                <li>Remplissez-le avec vos assets</li>
                <li>Enregistrez au format CSV (virgule)</li>
                <li>Uploadez-le ici</li>
              </ol>
            </div>

            <button type="button" onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 py-3 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 mb-4 text-sm font-medium">
              <Download size={16} />
              Télécharger le modèle CSV
            </button>

            {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label className="block">
                <div className={`flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  file ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}>
                  <input type="file" className="hidden" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
                  <FileSpreadsheet size={24} className={file ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{file ? file.name : 'Cliquez pour sélectionner un fichier CSV'}</span>
                  {file && <span className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>}
                </div>
              </label>

              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={!file || loading} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Importer
                </button>
                <button type="button" onClick={onClose} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
                  Annuler
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className={`rounded-lg p-4 mb-4 ${result.errors > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'}`}>
              <p className="font-medium text-sm mb-1">{result.inserted > 0 ? '✅' : '⚠️'} Import terminé</p>
              <p className="text-sm"><strong>{result.inserted}</strong> asset(s) créé(s){result.errors > 0 && <> — <strong>{result.errors}</strong> erreur(s)</>}</p>
            </div>
            {result.inserted > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assets créés :</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.details.map((d, i) => (
                    <div key={i} className="text-xs bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded">
                      <span className={`font-medium ${d.type === 'hardware' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>{d.type}</span> — {d.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.errorMessages && result.errorMessages.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Erreurs :</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errorMessages.map((err, i) => (
                    <div key={i} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded">{err}</div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onSuccess} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">Fermer et actualiser</button>
          </>
        )}
      </div>
    </div>
  )
}