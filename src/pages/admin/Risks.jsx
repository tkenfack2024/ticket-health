import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, X, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react'
import { api } from '../../api'

export default function AdminRisks() {
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  useEffect(() => { load() }, [filterStatus])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.risksGetAll({ status: filterStatus || undefined })
      setRisks(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, title) => {
    if (!confirm(`Supprimer le risque "${title}" ?`)) return
    try {
      await api.risksDelete(id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const filtered = risks.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.title.toLowerCase().includes(q) || 
           (r.category || '').toLowerCase().includes(q)
  })

  // Fonction pour les couleurs du score
  const getScoreColor = (score) => {
    if (score >= 15) return 'bg-red-100 text-red-700 border-red-200'
    if (score >= 8) return 'bg-orange-100 text-orange-700 border-orange-200'
    return 'bg-green-100 text-green-700 border-green-200'
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert size={22} className="text-red-600 dark:text-red-400" />
            Registre des Risques
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {risks.length} risque(s) — Conformité ISO 27001
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
        >
          <Plus size={16} /> Nouveau risque
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un risque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-dark max-w-[200px]">
            <option value="">Tous les statuts</option>
            <option value="Ouvert">Ouvert</option>
            <option value="En cours">En cours</option>
            <option value="Mitigé">Mitigé</option>
            <option value="Clos">Clos</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <ShieldAlert size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun risque identifié</p>
          <p className="text-slate-400 text-sm">Ajoutez votre premier risque pour démarrer l'analyse</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{r.title}</h3>
                  {r.category && <p className="text-xs text-slate-500 mt-0.5">{r.category}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-lg border font-bold text-lg ${getScoreColor(r.score)}`}>
                    {r.score}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setEditItem(r); setShowModal(true) }} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(r.id, r.title)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              {r.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{r.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                <div><span className="font-medium">Probabilité :</span> {r.probability}/5</div>
                <div><span className="font-medium">Impact :</span> {r.impact}/5</div>
                <div><span className="font-medium">Responsable :</span> {r.owner || 'Non défini'}</div>
                <div><span className="font-medium">Statut :</span> <span className={
                  r.status === 'Clos' ? 'text-green-600' :
                  r.status === 'Mitigé' ? 'text-blue-600' : 'text-red-600'
                }>{r.status}</span></div>
              </div>

              {r.mitigation_plan && (
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-100 dark:border-orange-800/50">
                  <strong className="text-orange-700 dark:text-orange-400">Plan de mitigation :</strong> {r.mitigation_plan}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RiskModal
          item={editItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function RiskModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    category: item?.category || '',
    probability: item?.probability || 3,
    impact: item?.impact || 3,
    mitigation_plan: item?.mitigation_plan || '',
    owner: item?.owner || '',
    status: item?.status || 'Ouvert',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const score = form.probability * form.impact
  const scoreColor = score >= 15 ? 'text-red-600' : score >= 8 ? 'text-orange-500' : 'text-green-600'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (item) await api.risksUpdate(item.id, form)
      else await api.risksCreate(form)
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
            {item ? 'Modifier le risque' : 'Nouveau risque'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre *</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="input-dark" placeholder="Ex: Perte de données serveur" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="input-dark">
                <option value="Ouvert">Ouvert</option>
                <option value="En cours">En cours</option>
                <option value="Mitigé">Mitigé</option>
                <option value="Clos">Clos</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="input-dark resize-none" placeholder="Décrivez le risque..." />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
              <input type="text" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="input-dark" placeholder="Ex: Cybersécurité" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Responsable</label>
              <input type="text" value={form.owner} onChange={(e) => setForm({...form, owner: e.target.value})} className="input-dark" placeholder="Ex: RSSI" />
            </div>
          </div>

          {/* Calcul du Score */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500"/>
              Évaluation de la criticité
            </h4>
            <div className="grid grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Probabilité (1 à 5)</label>
                <input type="range" min="1" max="5" value={form.probability} onChange={(e) => setForm({...form, probability: parseInt(e.target.value)})} className="w-full" />
                <div className="text-center font-bold text-slate-700 dark:text-slate-300 mt-1">{form.probability}</div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Impact (1 à 5)</label>
                <input type="range" min="1" max="5" value={form.impact} onChange={(e) => setForm({...form, impact: parseInt(e.target.value)})} className="w-full" />
                <div className="text-center font-bold text-slate-700 dark:text-slate-300 mt-1">{form.impact}</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600 text-center">
              <span className="text-sm text-slate-500 mr-2">Score de risque :</span>
              <span className={`text-2xl font-bold ${scoreColor}`}>{score} / 25</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan de mitigation</label>
            <textarea rows={2} value={form.mitigation_plan} onChange={(e) => setForm({...form, mitigation_plan: e.target.value})} className="input-dark resize-none" placeholder="Actions pour réduire le risque..." />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {item ? 'Enregistrer' : 'Créer le risque'}
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