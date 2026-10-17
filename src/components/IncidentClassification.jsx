import { useState, useEffect } from 'react'
import { AlertTriangle, Shield, AlertOctagon, CheckCircle, X } from 'lucide-react'
import { api } from '../api'

const INCIDENT_TYPES = {
  standard: {
    label: 'Standard',
    description: 'Incident normal',
    icon: AlertTriangle,
    color: 'bg-slate-100 text-slate-700',
    badge: 'badge-standard',
  },
  security: {
    label: 'Sécurité',
    description: 'Incident de sécurité (BAIT)',
    icon: Shield,
    color: 'bg-orange-100 text-orange-700',
    badge: 'badge-security',
  },
  major: {
    label: 'Majeur',
    description: 'Incident majeur DORA',
    icon: AlertOctagon,
    color: 'bg-red-100 text-red-700',
    badge: 'badge-major',
  },
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
      try {
        setDoraCriteria(JSON.parse(ticket.dora_criteria))
      } catch (e) {
        setDoraCriteria({})
      }
    }
  }, [ticket?.dora_criteria])

  const handleTypeChange = async (newType) => {
    setLoading(true)
    setError(null)
    try {
      await api.updateTicket(ticket.id, { incident_type: newType })
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!ticket) return null

  const currentType = INCIDENT_TYPES[ticket.incident_type] || INCIDENT_TYPES.standard
  const CurrentIcon = currentType.icon
  const doraCriteriaCount = Object.values(doraCriteria).filter(v => v === true).length

  return (
    <div className="p-6 border-b border-slate-200">
      <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <AlertOctagon size={18} className="text-red-600" />
        Classification de l'incident
      </h2>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Badge actuel */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 ${currentType.color}`}>
        <CurrentIcon size={14} />
        <span className="text-sm font-medium">{currentType.label}</span>
        <span className="text-xs opacity-75">— {currentType.description}</span>
      </div>

      {/* Boutons de type (admin uniquement) */}
      {isAdmin && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Type d'incident :</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INCIDENT_TYPES).map(([key, type]) => {
                const Icon = type.icon
                const isActive = ticket.incident_type === key
                return (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key)}
                    disabled={loading || isActive}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isActive
                        ? type.color
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={14} />
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* DORA — uniquement pour les incidents majeurs */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Classification DORA (incident majeur) :
            </p>
            {ticket.is_dora_major === 1 ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium">
                  <AlertOctagon size={14} />
                  Incident DORA majeur
                </span>
                <span className="text-xs text-slate-500">
                  {doraCriteriaCount} critère(s) sur {criteria.length} rempli(s)
                </span>
                <button
                  onClick={() => setShowDoraModal(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Modifier les critères
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDoraModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
              >
                <AlertOctagon size={16} />
                Évaluer les critères DORA
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal DORA */}
      {showDoraModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Critères DORA</h3>
                <p className="text-xs text-slate-500">
                  Cochez les critères remplis (au moins 2 = incident majeur)
                </p>
              </div>
              <button onClick={() => setShowDoraModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {criteria.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    doraCriteria[c.id]
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={doraCriteria[c.id] === true}
                    onChange={(e) => setDoraCriteria({ ...doraCriteria, [c.id]: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.description}</p>
                    <p className="text-xs text-slate-400 mt-1">Seuil : {c.threshold}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className={`p-3 rounded-lg mb-4 ${
              doraCriteriaCount >= 2
                ? 'bg-red-50 border border-red-200'
                : 'bg-slate-50 border border-slate-200'
            }`}>
              <p className={`text-sm font-medium ${doraCriteriaCount >= 2 ? 'text-red-700' : 'text-slate-700'}`}>
                {doraCriteriaCount} critère(s) rempli(s)
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {doraCriteriaCount >= 2
                  ? '⚠️ Cet incident sera classifié comme MAJEUR DORA'
                  : 'En dessous du seuil (2 critères minimum)'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveDora}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setShowDoraModal(false)}
                disabled={loading}
                className="flex-1 border border-slate-200 py-2 rounded-lg hover:bg-slate-50 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}