import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, X, Loader2, Building2, Mail, Phone, Paperclip, Download, FileText, Upload } from 'lucide-react'
import { api } from '../../api'

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Modales
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filesSupplier, setFilesSupplier] = useState(null)

  useEffect(() => { load() }, [filterStatus])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.suppliersGetAll({ status: filterStatus || undefined })
      setSuppliers(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer le fournisseur "${name}" et tous ses documents ?`)) return
    try {
      await api.suppliersDelete(id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const filtered = suppliers.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || 
           (s.contact_name || '').toLowerCase().includes(q) ||
           (s.email || '').toLowerCase().includes(q)
  })

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

    return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 size={22} className="text-blue-600 dark:text-blue-400" />
            Gestion des Fournisseurs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {suppliers.length} fournisseur(s) — Conformité ISO 20000
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nouveau fournisseur
        </button>
      </div>

                  {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          
          {/* Barre de recherche */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Rechercher un fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtre de statut */}
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="px-3 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="Actif">Actif</option>
            <option value="Inactif">Inactif</option>
            <option value="En attente">En attente</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Building2 size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun fournisseur</p>
          <p className="text-slate-400 text-sm">Ajoutez votre premier fournisseur pour démarrer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    s.status === 'Actif' ? 'bg-green-100 text-green-700' :
                    s.status === 'Inactif' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setFilesSupplier(s)} 
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded" 
                    title="Documents"
                  >
                    <Paperclip size={14} />
                  </button>
                  <button 
                    onClick={() => { setEditItem(s); setShowModal(true) }} 
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded" 
                    title="Modifier"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(s.id, s.name)} 
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded" 
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {s.contact_name && <p>👤 {s.contact_name}</p>}
                {s.email && <p className="flex items-center gap-1"><Mail size={12} /> {s.email}</p>}
                {s.phone && <p className="flex items-center gap-1"><Phone size={12} /> {s.phone}</p>}
                {s.contract_type && <p>📄 {s.contract_type}</p>}
                {s.contract_end && <p>📅 Fin : {new Date(s.contract_end).toLocaleDateString('fr-FR')}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal
          item={editItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}

      {filesSupplier && (
        <SupplierFilesModal
          supplier={filesSupplier}
          onClose={() => setFilesSupplier(null)}
        />
      )}
    </div>
  )
}

// ============ MODAL CRÉATION / ÉDITION ============
function SupplierModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    contact_name: item?.contact_name || '',
    email: item?.email || '',
    phone: item?.phone || '',
    contract_type: item?.contract_type || '',
    contract_start: item?.contract_start || '',
    contract_end: item?.contract_end || '',
    status: item?.status || 'Actif',
    notes: item?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (item) {
        await api.suppliersUpdate(item.id, form)
      } else {
        await api.suppliersCreate(form)
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
            {item ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="input-dark" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact</label>
              <input type="text" value={form.contact_name} onChange={(e) => setForm({...form, contact_name: e.target.value})} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="input-dark" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input-dark" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de contrat</label>
              <input type="text" value={form.contract_type} onChange={(e) => setForm({...form, contract_type: e.target.value})} placeholder="Ex: Maintenance" className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="input-dark">
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
                <option value="En attente">En attente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Début du contrat</label>
              <input type="date" value={form.contract_start} onChange={(e) => setForm({...form, contract_start: e.target.value})} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fin du contrat</label>
              <input type="date" value={form.contract_end} onChange={(e) => setForm({...form, contract_end: e.target.value})} className="input-dark" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="input-dark resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {item ? 'Enregistrer' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODAL FICHIERS ============
function SupplierFilesModal({ supplier, onClose }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { loadFiles() }, [])

  const loadFiles = async () => {
    try {
      const data = await api.suppliersGetFiles(supplier.id)
      setFiles(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await api.suppliersUploadFile(supplier.id, file)
      await loadFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = null // Reset input
    }
  }

  const handleDelete = async (fileId) => {
    if (!confirm('Supprimer ce document ?')) return
    try {
      await api.suppliersDeleteFile(fileId)
      loadFiles()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate pr-4">
            <Paperclip size={18} className="flex-shrink-0" />
            <span className="truncate">Documents : {supplier.name}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

        {/* Zone d'upload */}
        <div className="mb-6">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {uploading ? 'Envoi en cours...' : 'Cliquez pour ajouter un document'}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, JPG... (Max 5 Mo)</p>
            </div>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {/* Liste des fichiers */}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-sm text-slate-500">Chargement...</p>
          ) : files.length === 0 ? (
            <p className="text-center text-sm text-slate-500 italic">Aucun document attaché.</p>
          ) : (
            files.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText size={18} className="text-blue-500 flex-shrink-0" />
                  <div className="truncate">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={f.filename}>{f.filename}</p>
                    <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} Ko</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={api.suppliersDownloadFileUrl(f.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded"
                    title="Télécharger"
                  >
                    <Download size={16} />
                  </a>
                  <button onClick={() => handleDelete(f.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}