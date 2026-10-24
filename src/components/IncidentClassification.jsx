import { useState, useEffect } from 'react'
import { AlertTriangle, Shield, AlertOctagon, X } from 'lucide-react'
import { api } from '../api'

const INCIDENT_TYPES = {
  standard: { label: 'Standard', description: 'Incident normal', icon: AlertTriangle, color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  security: { label: 'Sécurité', description: 'Incident de sécurité (BAIT)', icon: Shield, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  major: { label: 'Majeur', description: 'Incident majeur DORA', icon: AlertOctagon, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function IncidentClassification({ ticket, onUpdate, isAdmin }) {
  const [criteria, setCriteria] = useState([])
  const [showDoraModal, setShowDoraModal] = useState(false)
  const [doraCriteria, setDoraCriteria] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getDoraCriteria()
      .then(setCriteria)
      .catch(err => console.error('Erreur critères DORA:', err))
  }, [])

  useEffect(() => {
    if (ticket?.dora_criteria) {
      try { setDoraCriteria(JSON.parse(ticket.dora_criteria)) } catch (e) { setDoraCriteria({}) }
    }
  }, [ticket?.dora_criteria])

  const handleTypeChange = async (newType) => {
    setLoading(true)
    setError(null)
    try {
      await api.updateTicket(ticket.id, { incident_type: newType })
      if (onUpdate) onUpdate()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleSaveDora = async () => {
    setLoading(true)
    setError(null)
    try {
      const checkedCount = Object.values(doraCriteria).filter(v => v === true).length
      const isMajor = checkedCount >= 2
      await api.updateTicket(ticket.id, {
        is_dora_major: isMajor,
        dora_criteria: doraCriteria,
        incident_type: isMajor ? 'major' : ticket.incident_type,
      })
      setShowDoraModal(false)
      if (onUpdate) onUpdate()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  if (!ticket) return null

  const currentType = INCIDENT_TYPES[ticket.incident_type] || INCIDENT_TYPES.standard
  const CurrentIcon = currentType.icon
  const doraCriteriaCount = Object.values(doraCriteria).filter(v => v === true).length

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
        <AlertOctagon size={18} className="text-red-600 dark:text-red-400" />
        Classification de l'incident
      </h2>

      {error && <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}

      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 ${currentType.color}`}>
        <CurrentIcon size={14} />
        <span className="text-sm font-medium">{currentType.label}</span>
        <span className="text-xs opacity-75">— {currentType.description}</span>
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type d'incident :</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INCIDENT_TYPES).map(([key, type]) => {
                const Icon = type.icon
                const isActive = ticket.incident_type === key
                return (
                  <button key={key} onClick={() => handleTypeChange(key)} disabled={loading || isActive}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isActive ? type.color : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}>
                    <Icon size={14} />{type.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Classification DORA :</p>
            {ticket.is_dora_major === 1 ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium"><AlertOctagon size={14} />Incident DORA majeur</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{doraCriteriaCount} critère(s) sur {criteria.length} rempli(s)</span>
                <button onClick={() => setShowDoraModal(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Modifier les critères</button>
              </div>
            ) : (
              <button onClick={() => setShowDoraModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">
                <AlertOctagon size={16} />Évaluer les critères DORA
              </button>
            )}
          </div>
        </div>
      )}

      {showDoraModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Critères DORA</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cochez les critères remplis (au moins 2 = incident majeur)</p>
              </div>
              <button onClick={() => setShowDoraModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
            </div>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {criteria.map((c) => (
                <label key={c.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  doraCriteria[c.id] ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}>
                  <input type="checkbox" checked={doraCriteria[c.id] === true} onChange={(e) => setDoraCriteria({ ...doraCriteria, [c.id]: e.target.checked })} className="w-4 h-4 mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{c.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Seuil : {c.threshold}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className={`p-3 rounded-lg mb-4 ${doraCriteriaCount >= 2 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600'}`}>
              <p className={`text-sm font-medium ${doraCriteriaCount >= 2 ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>{doraCriteriaCount} critère(s) rempli(s)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{doraCriteriaCount >= 2 ? '⚠️ Cet incident sera classifié comme MAJEUR DORA' : 'En dessous du seuil (2 critères minimum)'}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSaveDora} disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">Enregistrer</button>
              <button onClick={() => setShowDoraModal(false)} disabled={loading} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}