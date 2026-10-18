import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Box, Database, Network, Cloud, Monitor, Wrench,
  Plus, X, AlertTriangle, Star, Link as LinkIcon, TrendingDown
} from 'lucide-react'
import { api } from '../api'

const TYPE_CONFIG = {
  server: { icon: Server, label: 'Serveur', color: 'bg-blue-100 text-blue-700' },
  vm: { icon: Cloud, label: 'VM', color: 'bg-cyan-100 text-cyan-700' },
  application: { icon: Box, label: 'Application', color: 'bg-purple-100 text-purple-700' },
  database: { icon: Database, label: 'Base de données', color: 'bg-amber-100 text-amber-700' },
  network_device: { icon: Network, label: 'Réseau', color: 'bg-slate-100 text-slate-700' },
  service: { icon: Wrench, label: 'Service', color: 'bg-green-100 text-green-700' },
  endpoint: { icon: Monitor, label: 'Poste', color: 'bg-indigo-100 text-indigo-700' },
}

const CRITICALITY_CONFIG = {
  Critique: 'bg-red-100 text-red-700',
  Important: 'bg-orange-100 text-orange-700',
  Standard: 'bg-slate-100 text-slate-600',
}

export default function TicketCis({ ticketId, isAdmin }) {
  const [linkedCis, setLinkedCis] = useState([])
  const [allCis, setAllCis] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [ciDetails, setCiDetails] = useState({})

  const load = async () => {
    try {
      setLoading(true)
      const [linked, all] = await Promise.all([
        api.getTicketCis(ticketId),
        isAdmin ? api.cmdbGetCis() : Promise.resolve([]),
      ])
      setLinkedCis(linked)
      setAllCis(all)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [ticketId])

  const handleLink = async (ciId) => {
    try {
      await api.linkTicketCi(ticketId, ciId)
      setShowPicker(false)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUnlink = async (ciId) => {
    if (!confirm('Retirer ce CI du ticket ?')) return
    try {
      await api.unlinkTicketCi(ticketId, ciId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSetPrimary = async (ciId) => {
    try {
      await api.setPrimaryCi(ticketId, ciId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  // Charger les détails d'impact pour chaque CI lié
  useEffect(() => {
    const loadImpacts = async () => {
      const details = {}
      for (const ci of linkedCis) {
        try {
          const fullCi = await api.cmdbGetCi(ci.id)
          details[ci.id] = fullCi
        } catch (err) {
          console.error(`Erreur chargement CI ${ci.id}:`, err)
        }
      }
      setCiDetails(details)
    }
    if (linkedCis.length > 0) loadImpacts()
  }, [linkedCis])

  const availableCis = allCis.filter(ci => !linkedCis.some(l => l.id === ci.id))

  if (loading) {
    return (
      <div className="p-6 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Network size={18} className="text-slate-400" />
          Configuration Items
        </h2>
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="p-6 border-b border-slate-200">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Network size={18} className="text-blue-600" />
          Configuration Items ({linkedCis.length})
        </h2>
        {isAdmin && availableCis.length > 0 && (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
          >
            <Plus size={14} />
            Lier un CI
          </button>
        )}
      </div>

      {linkedCis.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500 text-center">
          Aucun CI lié à ce ticket.
          {isAdmin && (
            <p className="text-xs mt-1">
              Liez le CI concerné pour identifier l'équipement impacté.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {linkedCis.map((ci) => {
            const typeConf = TYPE_CONFIG[ci.type] || TYPE_CONFIG.server
            const Icon = typeConf.icon
            const critConf = CRITICALITY_CONFIG[ci.criticality] || ''
            const details = ciDetails[ci.id]
            const impacts = details?.impact_analysis || []

            return (
              <div
                key={ci.id}
                className={`bg-white rounded-lg border p-3 ${
                  ci.is_primary ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${typeConf.color} flex-shrink-0`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ci.is_primary === 1 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <Star size={10} fill="currentColor" />
                          Principal
                        </span>
                      )}
                      <Link
                        to={`/cmdb/${ci.id}`}
                        className="font-medium text-slate-800 hover:text-blue-600 text-sm"
                      >
                        {ci.name}
                      </Link>
                    </div>
                    {ci.code && (
                      <p className="text-xs text-slate-500 font-mono mb-1">{ci.code}</p>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${critConf}`}>
                        {ci.criticality}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        ci.status === 'En service' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {ci.status}
                      </span>
                    </div>

                    {/* Analyse d'impact */}
                    {impacts.length > 0 && (
                      <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                          <TrendingDown size={12} />
                          Impact : {impacts.length} CI(s) affecté(s)
                        </p>
                        <p className="text-xs text-red-700 mt-0.5">
                          {impacts.slice(0, 3).map(i => i.name).join(', ')}
                          {impacts.length > 3 && ` +${impacts.length - 3}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      {ci.is_primary !== 1 && (
                        <button
                          onClick={() => handleSetPrimary(ci.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Définir comme CI principal"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleUnlink(ci.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Délier"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de sélection */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Lier un Configuration Item</h3>
              <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {availableCis.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Tous les CIs sont déjà liés à ce ticket.
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {availableCis.map((ci) => {
                  const typeConf = TYPE_CONFIG[ci.type] || TYPE_CONFIG.server
                  const Icon = typeConf.icon
                  return (
                    <button
                      key={ci.id}
                      onClick={() => handleLink(ci.id)}
                      className="w-full text-left flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${typeConf.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{ci.name}</p>
                        <p className="text-xs text-slate-500">
                          {ci.code || 'Pas de code'} • {ci.criticality}
                        </p>
                      </div>
                      <LinkIcon size={14} className="text-slate-400" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}