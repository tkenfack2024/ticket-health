import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Box, Database, Network, Cloud, Monitor, Wrench,
  Search, AlertTriangle, Link as LinkIcon, Plus, X, Loader2,
} from 'lucide-react'
import { api } from '../../api'

const TYPE_CONFIG = {
  server: { icon: Server, label: 'Serveur', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  vm: { icon: Cloud, label: 'VM', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  application: { icon: Box, label: 'Application', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  database: { icon: Database, label: 'Base de données', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  network_device: { icon: Network, label: 'Équipement réseau', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  service: { icon: Wrench, label: 'Service', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  endpoint: { icon: Monitor, label: 'Poste de travail', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
}

const CRITICALITY_CONFIG = {
  Critique: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Important: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Standard: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const STATUS_CONFIG = {
  'En service': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'En maintenance': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Hors service': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'En stock': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Réformé': 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
}

export default function AdminCmdb() {
  const [cis, setCis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.cmdbGetCis({
        search: search || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
      })
      setCis(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, filterType, filterStatus])

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Network size={22} className="text-blue-600 dark:text-blue-400" />
            Configuration Items (CMDB)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{cis.length} élément(s) de configuration</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nouveau CI
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark pl-10"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Tous les statuts</option>
          <option>En service</option>
          <option>En maintenance</option>
          <option>Hors service</option>
          <option>En stock</option>
          <option>Réformé</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm">Chargement...</div>
      ) : cis.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Network size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucun CI enregistré</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">Cliquez sur "Nouveau CI" pour en créer un.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cis.map((ci) => <CiCard key={ci.id} ci={ci} />)}
        </div>
      )}

      {showModal && (
        <CreateCiModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function CiCard({ ci }) {
  const typeConf = TYPE_CONFIG[ci.type] || TYPE_CONFIG.server
  const Icon = typeConf.icon
  const critConf = CRITICALITY_CONFIG[ci.criticality] || CRITICALITY_CONFIG.Standard
  const statusConf = STATUS_CONFIG[ci.status] || STATUS_CONFIG['En service']

  return (
    <Link to={`/cmdb/${ci.id}`} className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all p-4 group">
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg ${typeConf.color}`}><Icon size={20} /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{ci.name}</h3>
          {ci.code && <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{ci.code}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConf.color}`}>{typeConf.label}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${critConf}`}>{ci.criticality}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConf}`}>{ci.status}</span>
      </div>
      {ci.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{ci.description}</p>}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex gap-3">
          <span title="Dépendances"><LinkIcon size={12} className="inline mr-1" />{ci.dependencies_count || 0}</span>
          <span title="Tickets liés"><AlertTriangle size={12} className="inline mr-1" />{ci.tickets_count || 0}</span>
        </div>
        <span className="text-xs">{ci.environment}</span>
      </div>
    </Link>
  )
}

function CreateCiModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'server',
    description: '',
    status: 'En service',
    environment: 'Production',
    location: '',
    owner: '',
    criticality: 'Standard',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.cmdbCreateCi(form)
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
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Nouveau Configuration Item</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nom *</label>
              <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-dark" placeholder="Serveur Web" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Code</label>
              <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="input-dark" placeholder="SRV-WEB-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Type *</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-dark">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Criticité</label>
              <select value={form.criticality} onChange={e => setForm({...form, criticality: e.target.value})} className="input-dark">
                <option value="Standard">Standard</option>
                <option value="Important">Important</option>
                <option value="Critique">Critique</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-dark resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Statut</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-dark">
                <option>En service</option>
                <option>En maintenance</option>
                <option>Hors service</option>
                <option>En stock</option>
                <option>Réformé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Environnement</label>
              <select value={form.environment} onChange={e => setForm({...form, environment: e.target.value})} className="input-dark">
                <option>Production</option>
                <option>Recette</option>
                <option>Développement</option>
                <option>Test</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Propriétaire</label>
              <input type="text" value={form.owner} onChange={e => setForm({...form, owner: e.target.value})} className="input-dark" placeholder="Équipe IT" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Notes (chiffré)</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-dark resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Créer le CI
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}