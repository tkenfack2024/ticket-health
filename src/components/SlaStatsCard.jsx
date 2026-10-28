import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, AlertTriangle, Timer, TrendingUp, ArrowRight } from 'lucide-react'
import { api } from '../api'

function formatMinutes(minutes) {
  if (!minutes && minutes !== 0) return '0min'
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export default function SlaStatsCard() {
  const [stats, setStats] = useState(null)
  const [criticalTickets, setCriticalTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
  api.get('/api/sla/stats'),
  api.getTickets(),
])
  .then(([statsData, ticketsRes]) => {
    setStats(statsData)
    const tickets = ticketsRes.data || []
    const critical = tickets
      .filter(t => t.sla_status === 'dépassé' || t.sla_status === 'menacé')
          .sort((a, b) => {
            const order = { 'dépassé': 0, 'menacé': 1 }
            return (order[a.sla_status] || 99) - (order[b.sla_status] || 99)
          })
          .slice(0, 5)
        setCriticalTickets(critical)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8">
        <p className="text-slate-500 dark:text-slate-400 text-sm">Chargement des statistiques SLA...</p>
      </div>
    )
  }

  if (error || !stats) return null

  const totalWithSla = stats.respected + stats.threatened + stats.exceeded
  const respectRate = totalWithSla > 0 ? Math.round((stats.respected / totalWithSla) * 100) : 100

  const barColor = respectRate >= 90 ? 'bg-green-500'
    : respectRate >= 70 ? 'bg-amber-500'
    : 'bg-red-500'

  const textColor = respectRate >= 90 ? 'text-green-700 dark:text-green-400'
    : respectRate >= 70 ? 'text-amber-700 dark:text-amber-400'
    : 'text-red-700 dark:text-red-400'

  return (
    <div className="mb-8">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
        Performances SLA
      </h2>

      {/* 4 cartes de stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Conformité</p>
              <p className={`text-2xl font-bold mt-1 ${textColor}`}>{respectRate}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stats.respected} / {totalWithSla} tickets
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              respectRate >= 90 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
              respectRate >= 70 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              <CheckCircle size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Menacés</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{stats.threatened}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">à surveiller</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Dépassés</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{stats.exceeded}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">hors délai</p>
            </div>
            <div className="p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">MTTR</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                {formatMinutes(stats.mttr_minutes)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">temps moyen</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Timer size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Taux de conformité global</p>
          <p className={`text-sm font-bold ${textColor}`}>{respectRate}%</p>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-500`}
            style={{ width: `${respectRate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
          <span>0%</span>
          <span className="text-slate-400 dark:text-slate-500">Objectif : 90%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Tickets critiques */}
      {criticalTickets.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              ⚠️ Tickets nécessitant votre attention
            </h3>
            <Link
              to="/tickets"
              className="text-blue-600 dark:text-blue-400 text-xs hover:underline flex items-center gap-1"
            >
              Voir tous <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {criticalTickets.map((t) => {
              const isExceeded = t.sla_status === 'dépassé'
              return (
                <Link
                  key={t.id}
                  to={`/tickets/${t.id}`}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isExceeded ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.category} • {t.priority}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 ${
                    isExceeded
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {isExceeded ? '🔴 Dépassé' : '🟡 Menacé'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}