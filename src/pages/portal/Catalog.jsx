import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Package, Monitor, Shield, Mail, Printer, BookOpen,
  Clock, CheckCircle, ChevronRight, Loader2,
} from 'lucide-react'
import { api } from '../../api'

const ICONS = {
  Monitor, Shield, Mail, Printer, BookOpen, Package,
}

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

const CATEGORY_LABELS = {
  Hardware: '🖥️ Matériel',
  Software: '💻 Logiciel',
  Access: '🔐 Accès',
  Incident: '🚨 Incident',
  Formation: '📚 Formation',
}

function formatSla(hours) {
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days} jour${days > 1 ? 's' : ''}`
}

export default function PortalCatalog() {
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.catalogGetServices()
      setServices(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredServices = services.filter(s => {
    if (filterCategory && s.category !== filterCategory) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return s.name.toLowerCase().includes(searchLower) ||
             (s.description && s.description.toLowerCase().includes(searchLower))
    }
    return true
  })

  // Grouper par catégorie
  const grouped = filteredServices.reduce((acc, s) => {
    const cat = s.category || 'Autre'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const categories = [...new Set(services.map(s => s.category).filter(Boolean))]

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement du catalogue...</div>

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Package size={26} className="text-blue-600 dark:text-blue-400" />
          Catalogue de services
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {services.length} service(s) disponible(s) — Choisissez un service pour faire votre demande
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Rechercher un service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark pl-10"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input-dark max-w-[200px]"
        >
          <option value="">Toutes les catégories</option>
          {categories.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {/* Services */}
      {filteredServices.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Package size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucun service trouvé</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            {search || filterCategory ? 'Essayez de modifier vos filtres' : 'Le catalogue est vide'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, categoryServices]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                {CATEGORY_LABELS[category] || category}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                  ({categoryServices.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryServices.map((service) => {
                  const Icon = ICONS[service.icon] || Package
                  const colorClass = COLOR_CLASSES[service.color] || COLOR_CLASSES.slate
                  return (
                    <button
                      key={service.id}
                      onClick={() => navigate(`/portal/catalog/${service.id}`)}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all p-5 text-left group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2.5 rounded-lg ${colorClass} flex-shrink-0`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {service.name}
                          </h3>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                      </div>

                      {service.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                          {service.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-700">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Clock size={12} />
                          SLA : {formatSla(service.sla_hours)}
                        </span>
                        {service.requires_approval ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <CheckCircle size={12} />
                            Approbation
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle size={12} />
                            Auto-approuvé
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}