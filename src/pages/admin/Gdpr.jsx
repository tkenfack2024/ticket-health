import { useState, useEffect } from 'react'
import { FileText, Plus, Edit, Trash2, Download, X, Loader2, AlertTriangle } from 'lucide-react'
import { api } from '../../api'

export default function AdminGdpr() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.gdprGetProcessing()
      setItems(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (item) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    try {
      await api.gdprDeleteProcessing(item.id)
      load()
    } catch (err) { alert(err.message) }
  }

  const handleExport = () => window.open(api.gdprExportUrl(), '_blank')

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={22} className="text-blue-600 dark:text-blue-400" />
            Registre des traitements GDPR
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{items.length} traitement(s) — Article 30 du RGPD</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium"><Download size={16} />Exporter CSV</button>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus size={16} />Nouveau traitement</button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">📋 Qu'est-ce qu'un registre des traitements ?</p>
        <p className="text-blue-800 dark:text-blue-400">Document obligatoire (article 30 GDPR) qui recense tous les traitements de données personnelles avec leur finalité, base légale, durée de conservation et mesures de sécurité.</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
            item.is_sensitive ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</h3>
                  {item.is_sensitive === 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      <AlertTriangle size={11} />Données sensibles
                    </span>
                  )}
                </div>
                {item.description && <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{item.description}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-xs">
                  {item.data_categories && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Données traitées</p><p className="text-slate-700 dark:text-slate-300">{item.data_categories}</p></div>}
                  {item.purpose && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Finalité</p><p className="text-slate-700 dark:text-slate-300">{item.purpose}</p></div>}
                  {item.legal_basis && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Base légale</p><p className="text-slate-700 dark:text-slate-300">{item.legal_basis}</p></div>}
                  {item.data_subjects && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Personnes concernées</p><p className="text-slate-700 dark:text-slate-300">{item.data_subjects}</p></div>}
                  {item.recipients && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Destinataires</p><p className="text-slate-700 dark:text-slate-300">{item.recipients}</p></div>}
                  {item.retention_period && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Conservation</p><p className="text-slate-700 dark:text-slate-300">{item.retention_period}</p></div>}
                  {item.security_measures && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Sécurité</p><p className="text-slate-700 dark:text-slate-300">{item.security_measures}</p></div>}
                  {item.data_location && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Localisation</p><p className="text-slate-700 dark:text-slate-300">{item.data_location}</p></div>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditing(item); setShowModal(true) }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit size={16} /></button>
                <button onClick={() => handleDelete(item)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && <GdprModal item={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSuccess={() => { setShowModal(false); setEditing(null); load() }} />}
    </div>
  )
}

function GdprModal({ item, onClose, onSuccess }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name || '', description: item?.description || '',
    data_categories: item?.data_categories || '', purpose: item?.purpose || '',
    legal_basis: item?.legal_basis || '', data_subjects: item?.data_subjects || '',
    recipients: item?.recipients || '', retention_period: item?.retention_period || '',
    security_measures: item?.security_measures || '', data_location: item?.data_location || '',
    is_sensitive: item?.is_sensitive === 1 || false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit) await api.gdprUpdateProcessing(item.id, form)
      else await api.gdprCreateProcessing(form)
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
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{isEdit ? `Modifier : ${item.name}` : 'Nouveau traitement'}</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-dark resize-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Données traitées</label><input type="text" value={form.data_categories} onChange={(e) => setForm({ ...form, data_categories: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Finalité</label><input type="text" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="input-dark" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base légale</label><input type="text" value={form.legal_basis} onChange={(e) => setForm({ ...form, legal_basis: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Personnes concernées</label><input type="text" value={form.data_subjects} onChange={(e) => setForm({ ...form, data_subjects: e.target.value })} className="input-dark" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destinataires</label><input type="text" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} className="input-dark" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conservation</label><input type="text" value={form.retention_period} onChange={(e) => setForm({ ...form, retention_period: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localisation</label><input type="text" value={form.data_location} onChange={(e) => setForm({ ...form, data_location: e.target.value })} className="input-dark" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mesures de sécurité</label><textarea rows={2} value={form.security_measures} onChange={(e) => setForm({ ...form, security_measures: e.target.value })} className="input-dark resize-none" /></div>
          <div>
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
              <input type="checkbox" checked={form.is_sensitive} onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })} className="w-4 h-4" />
              <AlertTriangle size={16} className="text-orange-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Ce traitement concerne des données sensibles</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}