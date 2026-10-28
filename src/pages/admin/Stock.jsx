// src/pages/admin/Stock.jsx
import { useState, useEffect } from 'react'
import { Plus, Search, Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, X, Loader2, History } from 'lucide-react'
import { api } from '../../api'

export default function AdminStock() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [movementModal, setMovementModal] = useState(null) // { type: 'ENTREE' | 'SORTIE', item }

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.get('/api/stock')
      setItems(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
  })

  if (loading) return <div className="p-8 text-slate-500">Chargement du stock...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package size={22} className="text-teal-600" />
            Stock Médical
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {items.length} article(s) — Gestion des consommables et petits matériels
          </p>
        </div>
                <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
          >
            <History size={16} /> Historique
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium"
          >
            <Plus size={16} /> Nouvel Article
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un article (nom, catégorie)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Package size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun article en stock</p>
          <p className="text-slate-400 text-sm">Ajoutez votre premier article pour démarrer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const isLow = item.current_quantity <= item.min_threshold
            const isEmpty = item.current_quantity === 0

            return (
              <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{item.name}</h3>
                    <p className="text-xs text-slate-500">{item.category || 'Sans catégorie'}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg font-bold text-lg flex items-center gap-2 ${
                    isEmpty ? 'bg-red-100 text-red-700' :
                    isLow ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {item.current_quantity} <span className="text-xs font-normal">{item.unit}</span>
                  </div>
                </div>

                {isLow && (
                  <div className="mt-2 text-xs flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle size={12} /> Seuil d'alerte atteint ({item.min_threshold} {item.unit})
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                  <button
                    onClick={() => setMovementModal({ type: 'ENTREE', item })}
                    className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 py-2 rounded-lg text-xs font-medium hover:bg-emerald-600 hover:text-white transition-colors"
                  >
                    <ArrowUpCircle size={14} /> Entrée
                  </button>
                  <button
                    onClick={() => setMovementModal({ type: 'SORTIE', item })}
                    className="flex-1 flex items-center justify-center gap-1 bg-rose-50 text-rose-700 py-2 rounded-lg text-xs font-medium hover:bg-rose-600 hover:text-white transition-colors"
                  >
                    <ArrowDownCircle size={14} /> Sortie
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateItemModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); load() }} />

      )}

	{showHistory && (
  <HistoryModal onClose={() => setShowHistory(false)} />
)}

      {movementModal && (
        <MovementModal
          type={movementModal.type}
          item={movementModal.item}
          onClose={() => setMovementModal(null)}
          onSuccess={() => { setMovementModal(null); load() }}
        />
      )}
    </div>
  )
}

// ============ MODALE CRÉATION ============
function CreateItemModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', category: '', unit: 'pièce', min_threshold: 5, initial_quantity: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/stock', form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Nouvel Article</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'article *</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder="Ex: Seringue 5ml" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
              <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-dark" placeholder="Ex: Consommable" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unité</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input-dark">
                <option value="pièce">Pièce</option>
                <option value="boîte">Boîte</option>
                <option value="flacon">Flacon</option>
                <option value="sachet">Sachet</option>
                <option value="litre">Litre</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seuil d'alerte</label>
              <input type="number" min="0" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: e.target.value })} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock initial</label>
              <input type="number" min="0" value={form.initial_quantity} onChange={e => setForm({ ...form, initial_quantity: e.target.value })} className="input-dark" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Créer
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODALE MOUVEMENT ============
function MovementModal({ type, item, onClose, onSuccess }) {
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEntry = type === 'ENTREE'
  const title = isEntry ? 'Entrée de stock' : 'Sortie de stock'
  const colorClass = isEntry ? 'emerald' : 'rose'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post(`/api/stock/${item.id}/movement`, { type, quantity, reason })
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Article : <strong>{item.name}</strong> — Stock actuel : <strong>{item.current_quantity} {item.unit}</strong>
        </p>
        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantité *</label>
            <input 
  type="number" 
  min="1" 
  required 
  value={quantity || ''} 
  onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value))} 
  className="input-dark" 
/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motif / Destination</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="input-dark" placeholder={isEntry ? 'Ex: Réception commande' : 'Ex: Bloc opératoire'} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className={`flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
  isEntry ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
}`}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEntry ? 'Ajouter au stock' : 'Retirer du stock'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODALE HISTORIQUE ============
function HistoryModal({ onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/stock/history')
      .then(data => { setHistory(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History size={20} /> Historique des mouvements
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {loading ? (
          <p className="text-center text-slate-500">Chargement...</p>
        ) : history.length === 0 ? (
          <p className="text-center text-slate-500 italic py-4">Aucun mouvement enregistré.</p>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qté</th>
                  <th className="px-4 py-3">Motif</th>
                  <th className="px-4 py-3">Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {history.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-xs text-slate-500">{new Date(m.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 font-medium">{m.item_name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        m.type === 'ENTREE' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="px-4 py-2">{m.quantity} {m.item_unit}</td>
                    <td className="px-4 py-2 text-slate-500">{m.reason || '-'}</td>
                    <td className="px-4 py-2 text-slate-500">{m.user_name || 'Système'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}