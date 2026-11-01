import { useState, useEffect } from 'react'
import {
  Building2, Plus, Search, Edit2, Trash2, X, Loader2,
  AlertTriangle, ShieldCheck, ShieldAlert, Globe, MapPin,
} from 'lucide-react'
import { api } from '../../api'

const CRITICALITY_CONFIG = {
  Critique: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  Important: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: ShieldAlert },
  Standard: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: ShieldCheck },
}

const STATUS_COLORS = {
  Actif: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Inactif: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  'En évaluation': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export default function AdminIctSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCriticality, setFilterCriticality] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.ictSuppliersGetAll({
        status: filterStatus || undefined,
        criticality: filterCriticality || undefined,
      })
      setSuppliers(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus, filterCriticality])

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer le tiers ICT "${name}" ?`)) return
    try {
      await api.ictSuppliersDelete(id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const filtered = suppliers.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) ||
           (s.service_type || '').toLowerCase().includes(q) ||
           (s.country || '').toLowerCase().includes(q)
  })

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 size={22} className="text-purple-600 dark:text-purple-400" />
            Registre des tiers ICT
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {suppliers.length} fournisseur(s) — Conformité DORA (Règlement UE 2022/2554)
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          <Plus size={16} /> Nouveau tiers ICT
        </button>
      </div>

      <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-sm">
        <p className="font-medium text-purple-900 dark:text-purple-300 mb-1">📋 Qu'est-ce qu'un registre des tiers ICT ?</p>
        <p className="text-purple-800 dark:text-purple-400">
          Obligation DORA (Article 28) : documenter tous les prestataires de services numériques critiques
          (cloud, hébergement, email, paiement, etc.) avec leur criticité, localisation des données, DPA signé et plan de sortie.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un tiers ICT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark pl-10"
          />
        </div>
        <select value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Toutes les criticités</option>
          <option value="Critique">Critique</option>
          <option value="Important">Important</option>
          <option value="Standard">Standard</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Tous les statuts</option>
          <option value="Actif">Actif</option>
          <option value="Inactif">Inactif</option>
          <option value="En évaluation">En évaluation</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Building2 size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium mb-1">Aucun tiers ICT enregistré</p>
          <p className="text-slate-400 text-sm">Ajoutez Turso, Render, Gmail pour démarrer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s) => {
            const critCfg = CRITICALITY_CONFIG[s.criticality] || CRITICALITY_CONFIG.Standard
            const CritIcon = critCfg.icon
            return (
              <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${critCfg.color}`}>
                        <CritIcon size={11} /> {s.criticality}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                        {s.status}
                      </span>
                      {s.dpa_signed === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <ShieldCheck size={11} /> DPA signé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <ShieldAlert size={11} /> DPA manquant
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{s.name}</h3>
                    {s.service_type && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{s.service_type}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditItem(s); setShowModal(true) }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {s.service_description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{s.service_description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                  {s.country && <div className="flex items-center gap-1"><Globe size={11} /> {s.country}</div>}
                  {s.data_location && <div className="flex items-center gap-1"><MapPin size={11} /> {s.data_location}</div>}
                  {s.contract_start && <div><strong>Début :</strong> {s.contract_start}</div>}
                  {s.contract_end && <div><strong>Fin :</strong> {s.contract_end}</div>}
                </div>

                {s.exit_plan && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-800/50">
                    <strong className="text-amber-700 dark:text-amber-400">Plan de sortie :</strong> {s.exit_plan}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <IctSupplierModal
          item={editItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSuccess={() => { setShowModal(false); setEditItem(null); load() }}
        />
      )}
    </div>
  )
}

function IctSupplierModal({ item, onClose, onSuccess }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name || '',
    service_type: item?.service_type || '',
    service_description: item?.service_description || '',
    criticality: item?.criticality || 'Standard',
    country: item?.country || '',
    dpa_signed: item?.dpa_signed === 1 || false,
    dpa_date: item?.dpa_date || '',
    contract_start: item?.contract_start || '',
    contract_end: item?.contract_end || '',
    contact_name: item?.contact_name || '',
    contact_email: item?.contact_email || '',
    contact_phone: item?.contact_phone || '',
    data_location: item?.data_location || '',
    exit_plan: item?.exit_plan || '',
    notes: item?.notes || '',
    status: item?.status || 'Actif',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit) await api.ictSuppliersUpdate(item.id, form)
      else await api.ictSuppliersCreate(form)
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
            {isEdit ? `Modifier "${item.name}"` : 'Nouveau tiers ICT'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark" placeholder="Ex: Turso, Render, Gmail"
            />
          </div>

          {/* Type + Critique */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de service</label>
              <input
                type="text" value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                className="input-dark" placeholder="Ex: Base de données cloud"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Criticité</label>
              <select
                value={form.criticality}
                onChange={(e) => setForm({ ...form, criticality: e.target.value })}
                className="input-dark"
              >
                <option value="Standard">Standard</option>
                <option value="Important">Important</option>
                <option value="Critique">Critique</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description du service</label>
            <textarea
              rows={2} value={form.service_description}
              onChange={(e) => setForm({ ...form, service_description: e.target.value })}
              className="input-dark resize-none"
              placeholder="Quel service est fourni ?"
            />
          </div>

          {/* Pays + Localisation données */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pays</label>
              <input
                type="text" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="input-dark" placeholder="Ex: États-Unis"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localisation des données</label>
              <input
                type="text" value={form.data_location}
                onChange={(e) => setForm({ ...form, data_location: e.target.value })}
                className="input-dark" placeholder="Ex: AWS eu-west-1"
              />
            </div>
          </div>

          {/* DPA */}
          <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox" checked={form.dpa_signed}
                onChange={(e) => setForm({ ...form, dpa_signed: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                DPA (Data Processing Agreement) signé
              </span>
            </label>
            {form.dpa_signed && (
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date de signature</label>
                <input
                  type="date" value={form.dpa_date}
                  onChange={(e) => setForm({ ...form, dpa_date: e.target.value })}
                  className="input-dark"
                />
              </div>
            )}
          </div>

          {/* Contrat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Début du contrat</label>
              <input
                type="date" value={form.contract_start}
                onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fin du contrat</label>
              <input
                type="date" value={form.contract_end}
                onChange={(e) => setForm({ ...form, contract_end: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact (nom)</label>
              <input
                type="text" value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
              <input
                type="text" value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email de contact</label>
            <input
              type="email" value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="input-dark"
            />
          </div>

          {/* Plan de sortie */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Plan de sortie (exit plan)
            </label>
            <textarea
              rows={2} value={form.exit_plan}
              onChange={(e) => setForm({ ...form, exit_plan: e.target.value })}
              className="input-dark resize-none"
              placeholder="Comment migrer vers un autre prestataire ?"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-dark resize-none"
            />
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="input-dark"
            >
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
              <option value="En évaluation">En évaluation</option>
            </select>
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button
              type="button" onClick={onClose} disabled={loading}
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
