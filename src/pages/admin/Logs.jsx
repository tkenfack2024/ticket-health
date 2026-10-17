import { useState, useEffect } from 'react'
import { Filter, ChevronLeft, ChevronRight, ScrollText, Download, Calendar, CheckCircle, CheckSquare, Square, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { api } from '../../api'

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  archive: 'bg-amber-100 text-amber-700',
  restore: 'bg-purple-100 text-purple-700',
  deactivate: 'bg-slate-100 text-slate-600',
  login: 'bg-slate-100 text-slate-600',
  'login-otp': 'bg-slate-100 text-slate-600',
  register: 'bg-cyan-100 text-cyan-700',
  'otp-request': 'bg-slate-100 text-slate-600',
}

const ENTITY_LABELS = {
  ticket: 'Ticket',
  user: 'Utilisateur',
  module: 'Module',
  asset: 'Asset',
}

const ACTIONS = ['create', 'update', 'delete', 'archive', 'restore', 'deactivate', 'login']
const ENTITIES = ['ticket', 'user', 'module', 'asset']
const PAGE_SIZE = 50

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
const [filterAction, setFilterAction] = useState('')
const [filterEntity, setFilterEntity] = useState('')
const [dateFrom, setDateFrom] = useState('')
const [dateTo, setDateTo] = useState('')
const [filterReviewed, setFilterReviewed] = useState('')
const [page, setPage] = useState(0)

const [stats, setStats] = useState(null)
const [selectedLogs, setSelectedLogs] = useState(new Set())
const [bulkLoading, setBulkLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
const [data, statsData] = await Promise.all([
  api.adminGetLogs({
    action: filterAction || undefined,
    entity: filterEntity || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    reviewed: filterReviewed || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }),
  api.adminGetReviewStats(),
])
setLogs(data.logs)
setTotal(data.total)
setStats(statsData)
setSelectedLogs(new Set()) // Reset sélection
      setLogs(data.logs)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

const handleSelectLog = (id) => {
  const newSelected = new Set(selectedLogs)
  if (newSelected.has(id)) newSelected.delete(id)
  else newSelected.add(id)
  setSelectedLogs(newSelected)
}

const handleSelectAll = () => {
  if (selectedLogs.size === logs.length) setSelectedLogs(new Set())
  else setSelectedLogs(new Set(logs.map(l => l.id)))
}

const handleBulkReview = async () => {
  if (selectedLogs.size === 0) return
  setBulkLoading(true)
  try {
    await api.adminBulkReviewLogs(Array.from(selectedLogs))
    await load()
  } catch (err) {
    alert(err.message)
  } finally {
    setBulkLoading(false)
  }
}

const handleSingleReview = async (id) => {
  try {
    await api.adminReviewLog(id)
    await load()
  } catch (err) {
    alert(err.message)
  }
}

const handleUnreview = async (id) => {
  try {
    await api.adminUnreviewLog(id)
    await load()
  } catch (err) {
    alert(err.message)
  }
}

useEffect(() => {
  load()
}, [filterAction, filterEntity, page, dateFrom, dateTo, filterReviewed])

  const totalPages = Math.ceil(total / PAGE_SIZE)

return (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-800">Journal d'activité</h2>
      <p className="text-slate-500 text-sm">{total} action(s) enregistrée(s)</p>
    </div>

    {/* Statistiques de revue */}
    {stats && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Taux de revue</p>
              <p className={`text-2xl font-bold mt-1 ${
                stats.review_rate >= 80 ? 'text-green-700' :
                stats.review_rate >= 50 ? 'text-amber-700' :
                'text-red-700'
              }`}>{stats.review_rate}%</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.reviewed} / {stats.total} revus</p>
            </div>
            <div className={`p-3 rounded-lg ${
              stats.review_rate >= 80 ? 'bg-green-100 text-green-600' :
              stats.review_rate >= 50 ? 'bg-amber-100 text-amber-600' :
              'bg-red-100 text-red-600'
            }`}>
              <CheckCircle size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">À revoir</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats.unreviewed}</p>
              <p className="text-xs text-slate-500 mt-0.5">logs non revus</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Dernier audit</p>
          {stats.last_review ? (
            <>
              <p className="text-sm font-bold text-slate-800 mt-1">{stats.last_review.reviewed_by}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.last_review.reviewed_at}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1 italic">Aucun audit effectué</p>
          )}
        </div>
      </div>
    )}

{/* Filtres */}
<div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
  {/* Ligne 1 : Action + Entité + Reset */}
  <div className="flex flex-wrap gap-3 items-center mb-3">
    <Filter size={16} className="text-slate-400" />
    <select
      value={filterAction}
      onChange={(e) => { setFilterAction(e.target.value); setPage(0) }}
      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Toutes les actions</option>
      {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
    <select
      value={filterEntity}
      onChange={(e) => { setFilterEntity(e.target.value); setPage(0) }}
      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Toutes les entités</option>
      {ENTITIES.map((e) => (
        <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
      ))}
    </select>

<select
  value={filterReviewed}
  onChange={(e) => { setFilterReviewed(e.target.value); setPage(0) }}
  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">Tous les logs</option>
  <option value="false">Non revus</option>
  <option value="true">Revus</option>
</select>
  </div>

  {/* Ligne 2 : Dates + Raccourcis + Export */}
  <div className="flex flex-wrap gap-3 items-center">
    <Calendar size={16} className="text-slate-400" />

    <div className="flex items-center gap-1 text-sm">
      <span className="text-slate-500">Du</span>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-slate-500">au</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => {
          // Ajouter 23:59:59 pour inclure toute la journée
          const val = e.target.value ? e.target.value + ' 23:59:59' : ''
          setDateTo(val)
          setPage(0)
        }}
        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* Raccourcis rapides */}
    <div className="flex gap-1">
      <button
        onClick={() => {
          const today = new Date().toISOString().slice(0, 10)
          setDateFrom(today + ' 00:00:00')
          setDateTo(today + ' 23:59:59')
          setPage(0)
        }}
        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
      >
        Aujourd'hui
      </button>
      <button
        onClick={() => {
          const now = new Date()
          const day = now.getDay() || 7
          const monday = new Date(now)
          monday.setDate(now.getDate() - day + 1)
          monday.setHours(0, 0, 0, 0)
          setDateFrom(monday.toISOString().slice(0, 10) + ' 00:00:00')
          setDateTo(now.toISOString().slice(0, 10) + ' 23:59:59')
          setPage(0)
        }}
        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
      >
        Semaine
      </button>
      <button
        onClick={() => {
          const now = new Date()
          const first = new Date(now.getFullYear(), now.getMonth(), 1)
          setDateFrom(first.toISOString().slice(0, 10) + ' 00:00:00')
          setDateTo(now.toISOString().slice(0, 10) + ' 23:59:59')
          setPage(0)
        }}
        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
      >
        Mois
      </button>
      <button
        onClick={() => {
          const now = new Date()
          const month = now.getMonth()
          const firstSemester = month < 6
          const start = firstSemester
            ? new Date(now.getFullYear(), 0, 1)
            : new Date(now.getFullYear(), 6, 1)
          const end = firstSemester
            ? new Date(now.getFullYear(), 5, 30)
            : new Date(now.getFullYear(), 11, 31)
          setDateFrom(start.toISOString().slice(0, 10) + ' 00:00:00')
          setDateTo(end.toISOString().slice(0, 10) + ' 23:59:59')
          setPage(0)
        }}
        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
      >
        Semestre
      </button>
    </div>

    {/* Reset */}
    {(filterAction || filterEntity || dateFrom || dateTo) && (
      <button
        onClick={() => {
          setFilterAction('')
          setFilterEntity('')
          setDateFrom('')
          setDateTo('')
          setPage(0)
        }}
        className="text-xs text-slate-500 hover:text-slate-700 underline ml-auto"
      >
        Réinitialiser tout
      </button>
    )}

    {/* Bouton Export CSV */}
    <a
      href={api.adminExportLogsCSV({
        action: filterAction || undefined,
        entity: filterEntity || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })}
      onClick={(e) => {
        // Ouvrir dans un nouvel onglet (le téléchargement se déclenchera)
        // On a besoin du token en query string
        e.preventDefault()
        const token = localStorage.getItem('ht_token')
        const url = api.adminExportLogsCSV({
          action: filterAction || undefined,
          entity: filterEntity || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
        // Ajouter le token en query
        const finalUrl = url + (url.includes('?') ? '&' : '?') + `token=${token}`
        window.open(finalUrl, '_blank')
      }}
      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium ml-auto"
    >
      <Download size={14} />
      Exporter CSV
    </a>
  </div>
</div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

{selectedLogs.size > 0 && (
  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
    <p className="text-sm text-blue-900 font-medium">
      {selectedLogs.size} log(s) sélectionné(s)
    </p>
    <div className="flex gap-2">
      <button
        onClick={() => setSelectedLogs(new Set())}
        className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5"
      >
        Annuler
      </button>
      <button
        onClick={handleBulkReview}
        disabled={bulkLoading}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
      >
        {bulkLoading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <CheckSquare size={14} />
        )}
        Marquer comme revus
      </button>
    </div>
  </div>
)}

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <ScrollText size={32} className="mx-auto mb-2 text-slate-300" />
          Aucun log correspondant.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
           <table className="w-full">
  <thead className="bg-slate-50 border-b border-slate-200">
    <tr>
      <th className="text-center px-2 py-3 w-10">
        <button
          onClick={handleSelectAll}
          className="text-slate-400 hover:text-slate-700"
          title={selectedLogs.size === logs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        >
          {selectedLogs.size === logs.length && logs.length > 0 ? (
            <CheckSquare size={16} />
          ) : (
            <Square size={16} />
          )}
        </button>
      </th>
      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Entité</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
               {logs.map((log) => (
  <tr key={log.id} className={`hover:bg-slate-50 ${log.reviewed ? 'bg-green-50/30' : ''}`}>
    <td className="text-center px-2 py-2.5">
      <button
        onClick={() => handleSelectLog(log.id)}
        className="text-slate-400 hover:text-slate-700"
      >
        {selectedLogs.has(log.id) ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>
    </td>
    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">
      {log.created_at}
    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {log.user_name || <span className="text-slate-400 italic">Système</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">
                      {ENTITY_LABELS[log.entity] || log.entity}
                      {log.entity_id && <span className="text-slate-400 ml-1">#{log.entity_id}</span>}
                    </td>
    <td className="px-4 py-2.5 text-sm text-slate-600">
      {log.details || '-'}
    </td>
    <td className="px-4 py-2.5 text-right">
      {log.reviewed ? (
        <div className="flex items-center justify-end gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
            title={`Revu par ${log.reviewed_by} le ${log.reviewed_at}`}
          >
            <CheckCircle size={11} />
            Revu
          </span>
          <button
            onClick={() => handleUnreview(log.id)}
            className="p-1 text-slate-400 hover:text-amber-600"
            title="Démarquer"
          >
            <EyeOff size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => handleSingleReview(log.id)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
        >
          <Eye size={11} />
          Marquer revu
        </button>
      )}
    </td>
  </tr>
))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-slate-500">Page {page + 1} sur {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Précédent
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}