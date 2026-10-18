import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Server, Box, Database, Network, Cloud, Monitor, Wrench,
  AlertTriangle, Link as LinkIcon, ExternalLink, Trash2, Edit,
  Users, MapPin, User, Calendar, TrendingDown
} from 'lucide-react'
import { api } from '../../api'

const TYPE_CONFIG = {
  server: { icon: Server, label: 'Serveur', color: 'bg-blue-100 text-blue-700' },
  vm: { icon: Cloud, label: 'VM', color: 'bg-cyan-100 text-cyan-700' },
  application: { icon: Box, label: 'Application', color: 'bg-purple-100 text-purple-700' },
  database: { icon: Database, label: 'Base de données', color: 'bg-amber-100 text-amber-700' },
  network_device: { icon: Network, label: 'Équipement réseau', color: 'bg-slate-100 text-slate-700' },
  service: { icon: Wrench, label: 'Service', color: 'bg-green-100 text-green-700' },
  endpoint: { icon: Monitor, label: 'Poste de travail', color: 'bg-indigo-100 text-indigo-700' },
}

const RELATION_LABELS = {
  depends_on: 'Dépend de',
  hosts: 'Héberge',
  runs_on: 'Tourne sur',
  connects_to: 'Connecté à',
  part_of: 'Fait partie de',
}

const CRITICALITY_CONFIG = {
  Critique: 'bg-red-100 text-red-700',
  Important: 'bg-orange-100 text-orange-700',
  Standard: 'bg-slate-100 text-slate-600',
}

const STATUS_CONFIG = {
  'En service': 'bg-green-100 text-green-700',
  'En maintenance': 'bg-amber-100 text-amber-700',
  'Hors service': 'bg-red-100 text-red-700',
  'En stock': 'bg-blue-100 text-blue-700',
  'Réformé': 'bg-slate-100 text-slate-500',
}

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return d }
}

export default function CmdbDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ci, setCi] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.cmdbGetCi(id)
      .then(setCi)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${ci.name}" ?`)) return
    try {
      await api.cmdbDeleteCi(id)
      navigate('/admin')
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>
  if (error && !ci) return <div className="p-8 text-red-600">{error}</div>
  if (!ci) return null

  const typeConf = TYPE_CONFIG[ci.type] || TYPE_CONFIG.server
  const Icon = typeConf.icon
  const critConf = CRITICALITY_CONFIG[ci.criticality] || CRITICALITY_CONFIG.Standard
  const statusConf = STATUS_CONFIG[ci.status] || STATUS_CONFIG['En service']

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/admin" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={18} />
        Retour à l'administration
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${typeConf.color}`}>
              <Icon size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{ci.name}</h1>
              {ci.code && <p className="text-sm font-mono text-slate-500">{ci.code}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConf.color}`}>
                  {typeConf.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${critConf}`}>
                  {ci.criticality}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConf}`}>
                  {ci.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
            >
              <Trash2 size={16} />
              Supprimer
            </button>
          </div>
        </div>

        {ci.description && (
          <p className="text-slate-600 mb-4">{ci.description}</p>
        )}

        {/* Infos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          {ci.environment && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Environnement</p>
              <p className="text-sm font-medium text-slate-800 mt-1">{ci.environment}</p>
            </div>
          )}
          {ci.location && (
            <div className="flex items-start gap-2">
              <MapPin size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Localisation</p>
                <p className="text-sm font-medium text-slate-800 mt-1">{ci.location}</p>
              </div>
            </div>
          )}
          {ci.owner && (
            <div className="flex items-start gap-2">
              <User size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Propriétaire</p>
                <p className="text-sm font-medium text-slate-800 mt-1">{ci.owner}</p>
              </div>
            </div>
          )}
        </div>

        {ci.asset_name && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Asset lié</p>
            <p className="text-sm font-medium text-slate-800">
              {ci.asset_name}
              {ci.asset_serial_number && (
                <span className="text-xs font-mono text-slate-500 ml-2">
                  S/N: {ci.asset_serial_number}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Analyse d'impact */}
      {ci.impact_analysis && ci.impact_analysis.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
            <TrendingDown size={18} />
            Analyse d'impact
          </h2>
          <p className="text-sm text-red-800 mb-3">
            Si ce CI tombe en panne, <strong>{ci.impact_analysis.length} autre(s) CI(s)</strong> seraient affectés :
          </p>
          <div className="space-y-2">
            {ci.impact_analysis.map((imp) => (
              <div key={imp.ci_id} className="flex items-center gap-2 bg-white/70 rounded p-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{imp.name}</p>
                  <p className="text-xs text-slate-500">
                    {RELATION_LABELS[imp.relation_type] || imp.relation_type}
                    {imp.level > 1 && ` • Niveau ${imp.level}`}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  CRITICALITY_CONFIG[imp.criticality] || ''
                }`}>
                  {imp.criticality}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
{/* Relations sortantes — ce CI dépend de... */}
<div className="bg-white rounded-xl border border-slate-200 p-6">
  <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
    <LinkIcon size={18} className="text-blue-600" />
    Dépend de ({ci.relations_out?.length || 0})
  </h2>
          {ci.relations_out && ci.relations_out.length > 0 ? (
            <div className="space-y-2">
              {ci.relations_out.map((rel) => (
                <div key={rel.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{rel.name}</p>
                    <p className="text-xs text-slate-500">
                      {RELATION_LABELS[rel.relation_type] || rel.relation_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Aucune dépendance</p>
          )}
        </div>

        {/* Relations entrantes */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <LinkIcon size={18} className="text-green-600" />
            Utilisé par ({ci.relations_in?.length || 0})
          </h2>
          {ci.relations_in && ci.relations_in.length > 0 ? (
            <div className="space-y-2">
              {ci.relations_in.map((rel) => (
                <div key={rel.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{rel.name}</p>
                    <p className="text-xs text-slate-500">
                      {RELATION_LABELS[rel.relation_type] || rel.relation_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Aucun CI ne dépend de celui-ci</p>
          )}
        </div>
      </div>

      {/* Tickets liés */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-600" />
          Tickets liés ({ci.tickets?.length || 0})
        </h2>
        {ci.tickets && ci.tickets.length > 0 ? (
          <div className="space-y-2">
            {ci.tickets.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">#{t.id} — {t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.status} • {t.priority}
                    {t.is_primary === 1 && ' • CI principal'}
                  </p>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">Aucun ticket lié</p>
        )}
      </div>
    </div>
  )
}