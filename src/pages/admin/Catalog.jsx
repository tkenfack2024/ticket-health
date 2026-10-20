import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, Plus, Search, CheckCircle, XCircle, Clock,
  Monitor, Shield, Mail, Printer, BookOpen, ExternalLink,
  Edit, Trash2, X, Loader2, FileText, ChevronRight,
} from 'lucide-react'
import { api } from '../../api'

const ICONS = { Monitor, Shield, Mail, Printer, BookOpen, Package }

const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

const STATUS_CONFIG = {
  pending_approval: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  approved: { label: 'Approuvée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  rejected: { label: 'Refusée', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
}

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return d }
}

export default function AdminCatalog() {
  const [activeTab, setActiveTab] = useState('requests')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Package size={22} className="text-blue-600 dark:text-blue-400" />
          Catalogue de services
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Gérez les services et validez les demandes
        </p>
      </div>

      {/* Onglets internes */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Demandes
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'services'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Package size={16} />
            Services
          </button>
        </div>
      </div>

      {activeTab === 'requests' && <RequestsTab />}
      {activeTab === 'services' && <ServicesTab />}
    </div>
  )
}

// ============ ONGLET DEMANDES ============

function RequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('pending_approval')
  const [rejectModal, setRejectModal] = useState(null)

  useEffect(() => {
    load()
  }, [filterStatus])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.catalogAdminGetRequests({ status: filterStatus || undefined })
      setRequests(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    if (!confirm('Approuver cette demande ? Un ticket sera créé automatiquement.')) return
    try {
      await api.catalogAdminApprove(id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-dark max-w-[200px]"
        >
          <option value="">Toutes les demandes</option>
          <option value="pending_approval">En attente d'approbation</option>
          <option value="approved">Approuvées</option>
          <option value="rejected">Refusées</option>
          <option value="delivered">Livrées</option>
        </select>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {requests.length} demande(s)
        </span>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <FileText size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucune demande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending_approval
            const StatusIcon = statusCfg.icon
            const Icon = ICONS[request.service_icon] || Package
            const colorClass = COLOR_CLASSES[request.service_color] || COLOR_CLASSES.slate

            return (
              <div key={request.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${colorClass} flex-shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">#{request.id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{request.service_name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Par <strong>{request.requester_name}</strong> ({request.requester_email}) — {formatDate(request.created_at)}
                    </p>

                    {/* Détails du formulaire */}
                    {request.form_data && Object.keys(request.form_data).length > 0 && (
                      <div className="mt-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
                        {Object.entries(request.form_data).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-500 dark:text-slate-400">{key} :</span>{' '}
                            <span className="text-slate-700 dark:text-slate-300">{value || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {request.rejection_reason && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        <strong>Motif de refus :</strong> {request.rejection_reason}
                      </p>
                    )}

                    {request.status === 'pending_approval' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          <CheckCircle size={16} />
                          Approuver
                        </button>
                        <button
                          onClick={() => setRejectModal(request)}
                          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                        >
                          <XCircle size={16} />
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rejectModal && (
        <RejectModal
          request={rejectModal}
          onClose={() => setRejectModal(null)}
          onSuccess={() => { setRejectModal(null); load() }}
        />
      )}
    </div>
  )
}

// ============ ONGLET SERVICES ============

function ServicesTab() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.catalogAdminGetServices()
      setServices(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (service) => {
    if (!confirm(`Désactiver "${service.name}" ?`)) return
    try {
      await api.catalogAdminDeleteService(service.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{services.length} service(s)</p>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau service
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => {
          const Icon = ICONS[service.icon] || Package
          const colorClass = COLOR_CLASSES[service.color] || COLOR_CLASSES.slate

          return (
            <div key={service.id} className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${!service.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{service.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {service.request_count || 0} demande(s) • {service.requires_approval ? '⚠️ Approbation' : '✅ Auto'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditing(service); setShowModal(true) }}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Modifier"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Désactiver"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {service.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{service.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  SLA : {service.sla_hours < 24 ? `${service.sla_hours}h` : `${Math.floor(service.sla_hours / 24)}j`}
                </span>
                <span>{service.category}</span>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <ServiceModal
          service={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSuccess={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ============ MODAL : Refuser ============

function RejectModal({ request, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.catalogAdminReject(request.id, reason)
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
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Refuser la demande</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Demande : <strong>{request.service_name}</strong> par {request.requester_name}
        </p>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Motif du refus *
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez pourquoi cette demande est refusée..."
              className="input-dark resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Refuser'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODAL : Service ============

function ServiceModal({ service, onClose, onSuccess }) {
  const isEdit = !!service
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || 'Hardware',
    icon: service?.icon || 'Package',
    color: service?.color || 'blue',
    sla_hours: service?.sla_hours || 24,
    requires_approval: service?.requires_approval !== undefined ? service.requires_approval === 1 : true,
    form_fields: service?.form_fields || [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await api.catalogAdminUpdateService(service.id, form)
      } else {
        await api.catalogAdminCreateService(form)
      }
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
            {isEdit ? `Modifier "${service.name}"` : 'Nouveau service'}
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-dark resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catégorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-dark"
              >
                <option>Hardware</option>
                <option>Software</option>
                <option>Access</option>
                <option>Incident</option>
                <option>Formation</option>
                <option>Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SLA (heures) *</label>
              <input
                type="number"
                required
                min="1"
                value={form.sla_hours}
                onChange={(e) => setForm({ ...form, sla_hours: parseInt(e.target.value) || 1 })}
                className="input-dark"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
              <input
                type="checkbox"
                checked={form.requires_approval}
                onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Nécessite une approbation</span>
            </label>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            ⚠️ Les champs du formulaire (form_fields) ne sont pas éditables ici.
            Utilise la DB ou contacte le support pour les modifier.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}