import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Box, Database, Network, Cloud, Monitor, Wrench,
  Plus, X, Star, Link as LinkIcon, TrendingDown,
} from 'lucide-react'
import { api } from '../api'

const TYPE_CONFIG = {
  server: { icon: Server, label: 'Serveur', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  vm: { icon: Cloud, label: 'VM', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  application: { icon: Box, label: 'Application', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  database: { icon: Database, label: 'Base de données', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  network_device: { icon: Network, label: 'Réseau', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  service: { icon: Wrench, label: 'Service', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  endpoint: { icon: Monitor, label: 'Poste', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
}

const CRITICALITY_CONFIG = {
  Critique: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Important: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Standard: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
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
    } catch (err) { console.error(err); setLoading(false) }
  }

  useEffect(() => { load() }, [ticketId])

  const handleLink = async (ciId) => {
    try {
      await api.linkTicketCi(ticketId, ciId)
      setShowPicker(false)
      await load()
    } catch (err) { alert(err.message) }
  }

  const handleUnlink = async (ciId) => {
    if (!confirm('Retirer ce CI du ticket ?')) return
    try {
      await api.unlinkTicketCi(ticketId, ciId)
      await load()
    } catch (err) { alert(err.message) }
  }

  const handleSetPrimary = async (ciId) => {
    try {
      await api.setPrimaryCi(ticketId, ciId)
      await load()
    } catch (err) { alert(err.message) }
  }

  useEffect(() => {
    const loadImpacts = async () => {
      const details = {}
      for (const ci of linkedCis) {
        try {
          const fullCi = await api.cmdbGetCi(ci.id)
          details[ci.id] = fullCi
        } catch (err) { console.error(`Erreur chargement CI ${ci.id}:`, err) }
      }
      setCiDetails(details)
    }
    if (linkedCis.length > 0) loadImpacts()
  }, [linkedCis])

  const availableCis = allCis.filter(ci => !linkedCis.some(l => l.id === ci.id))

  if (loading) {
    return (
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Network size={18} className="text-slate-400 dark:text-slate-500" />Configuration Items
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Network size={18} className="text-blue-600 dark:text-blue-400" />
          Configuration Items ({linkedCis.length})
        </h2>
        {isAdmin && availableCis.length > 0 && (
          <button onClick={() => setShowPicker(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg">
            <Plus size={14} />Lier un CI
          </button>
        )}
      </div>

      {linkedCis.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-sm text-slate-500 dark:text-slate-400 text-center">
          Aucun CI lié à ce ticket.
          {isAdmin && <p className="text-xs mt-1">Liez le CI concerné pour identifier l'équipement impacté.</p>}
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
              <div key={ci.id} className={`bg-white dark:bg-slate-800 rounded-lg border p-3 ${ci.is_primary ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${typeConf.color} flex-shrink-0`}><Icon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ci.is_primary === 1 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"><Star size={10} fill="currentColor" />Principal</span>}
                      <Link to={`/cmdb/${ci.id}`} className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-sm">{ci.name}</Link>
                    </div>
                    {ci.code && <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">{ci.code}</p>}
                    <div className="flex gap-1 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeConf.color}`}>{typeConf.label}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${critConf}`}>{ci.criticality}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ci.status === 'En service' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{ci.status}</span>
                    </div>
                    {impacts.length > 0 && (
                      <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                        <p className="text-xs font-medium text-red-800 dark:text-red-300 flex items-center gap-1"><TrendingDown size={12} />Impact : {impacts.length} CI(s) affecté(s)</p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{impacts.slice(0, 3).map(i => i.name).join(', ')}{impacts.length > 3 && ` +${impacts.length - 3}`}</p>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      {ci.is_primary !== 1 && <button onClick={() => handleSetPrimary(ci.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Définir comme CI principal"><Star size={14} /></button>}
                      <button onClick={() => handleUnlink(ci.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Délier"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Lier un Configuration Item</h3>
              <button onClick={() => setShowPicker(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
            </div>
            {availableCis.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Tous les CIs sont déjà liés à ce ticket.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {availableCis.map((ci) => {
                  const typeConf = TYPE_CONFIG[ci.type] || TYPE_CONFIG.server
                  const Icon = typeConf.icon
                  return (
                    <button key={ci.id} onClick={() => handleLink(ci.id)} className="w-full text-left flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors">
                      <div className={`p-2 rounded-lg ${typeConf.color}`}><Icon size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{ci.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{ci.code || 'Pas de code'} • {ci.criticality}</p>
                      </div>
                      <LinkIcon size={14} className="text-slate-400 dark:text-slate-500" />
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