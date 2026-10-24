import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Package, Monitor, Shield, Mail, Printer, BookOpen,
  Clock, CheckCircle, AlertTriangle, Loader2, Send,
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

function formatSla(hours) {
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days} jour${days > 1 ? 's' : ''}`
}

export default function CatalogService() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [service, setService] = useState(null)
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadService()
  }, [id])

  const loadService = async () => {
    try {
      setLoading(true)
      const data = await api.catalogGetService(id)
      setService(data)

      // Initialiser le formulaire
      const initial = {}
      if (data.form_fields) {
        for (const field of data.form_fields) {
          initial[field.name] = ''
        }
      }
      setFormData(initial)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.catalogCreateRequest({
        service_id: parseInt(id),
        form_data: formData,
      })
      setSuccess(true)
      // Rediriger après 2s
      setTimeout(() => {
        navigate('/portal/my-requests')
      }, 2000)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement...</div>
  if (error && !service) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>
  if (!service) return null

  const Icon = ICONS[service.icon] || Package
  const colorClass = COLOR_CLASSES[service.color] || COLOR_CLASSES.slate

  if (success) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Demande envoyée !
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {service.requires_approval
              ? 'Votre demande est en attente d\'approbation.'
              : 'Votre demande a été traitée. Un ticket a été créé.'}
          </p>
          <Link
            to="/portal/my-requests"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            Voir mes demandes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link to="/portal/catalog" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} />
        Retour au catalogue
      </Link>

      {/* En-tête */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{service.name}</h1>
            {service.category && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass} mt-1`}>
                {service.category}
              </span>
            )}
          </div>
        </div>

        {service.description && (
          <p className="text-slate-600 dark:text-slate-300 mb-4">{service.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm pt-4 border-t border-slate-100 dark:border-slate-700">
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
            <Clock size={14} />
            SLA : {formatSla(service.sla_hours)}
          </span>
          {service.requires_approval ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <CheckCircle size={14} />
              Nécessite une approbation
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle size={14} />
              Traitement automatique
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Détails de votre demande
        </h2>

        <div className="space-y-4">
          {service.form_fields && service.form_fields.map((field, index) => {
            const value = formData[field.name] || ''

            return (
              <div key={index}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    required={field.required}
                    value={value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="input-dark"
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    required={field.required}
                    value={value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    rows={4}
                    className="input-dark resize-none"
                  />
                )}

                {field.type === 'select' && field.options && (
                  <select
                    required={field.required}
                    value={value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="input-dark"
                  >
                    <option value="">— Sélectionnez —</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    required={field.required}
                    value={value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="input-dark"
                  />
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    required={field.required}
                    value={value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="input-dark"
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Envoi...' : 'Envoyer la demande'}
          </button>
          <Link
            to="/portal/catalog"
            className="px-6 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}