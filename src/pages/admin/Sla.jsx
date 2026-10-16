import { useState, useEffect } from 'react'
import { Save, Download, X, Loader2, Clock, AlertTriangle, CheckCircle, Timer } from 'lucide-react'
import { api } from '../../api'

const PRIORITY_COLORS = {
  Urgente: 'bg-red-100 text-red-700',
  Haute: 'bg-orange-100 text-orange-700',
  Moyenne: 'bg-yellow-100 text-yellow-700',
  Basse: 'bg-slate-100 text-slate-600',
}

function formatMinutes(minutes) {
  if (!minutes && minutes !== 0) return '—'
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export default function AdminSla() {
  const [policies, setPolicies] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [policiesData, statsData] = await Promise.all([
        api.get('/api/sla/policies'),
        api.get('/api/sla/stats'),
      ])
      setPolicies(policiesData)
      setStats(statsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleExport = () => {
    const token = localStorage.getItem('ht_token')
    const url = `http://localhost:3001/api/sla/export?token=${token}`
    window.open(url, '_blank')
  }

  if (loading) return <div className="p-6 text-slate-500">Chargement...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Politiques SLA</h2>
          <p className="text-slate-500 text-sm">
            Configurez les engagements de temps de réponse et de résolution
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Exporter rapport CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={CheckCircle}
            label="SLA respecté"
            value={`${stats.respect_rate}%`}
            color="bg-green-100 text-green-600"
            sub={`${stats.respected + stats.threatened + stats.exceeded > 0 ? Math.round((stats.respected / (stats.respected + stats.threatened + stats.exceeded)) * 100) : 100}%`}
          />
          <StatCard
            icon={AlertTriangle}
            label="SLA menacé"
            value={stats.threatened}
            color="bg-amber-100 text-amber-600"
            sub="à surveiller"
          />
          <StatCard
            icon={AlertTriangle}
            label="SLA dépassé"
            value={stats.exceeded}
            color="bg-red-100 text-red-600"
            sub="hors délai"
          />
          <StatCard
            icon={Timer}
            label="MTTR moyen"
            value={formatMinutes(stats.mttr_minutes)}
            color="bg-blue-100 text-blue-600"
            sub="temps de résolution"
          />
        </div>
      )}

      {/* Tableau des politiques */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Priorité</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Temps de réponse</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Temps de résolution</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Seuil escalade</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {policies.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[p.priority] || ''}`}>
                    {p.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {formatMinutes(p.response_minutes)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                  {formatMinutes(p.resolution_minutes)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {p.escalation_percent}%
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(p)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 text-sm mb-2">💡 Comment ça marche ?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>Le temps de réponse</strong> est le délai maximum pour qu'un technicien prenne le ticket en charge.</li>
          <li><strong>Le temps de résolution</strong> est le délai maximum pour résoudre complètement le ticket.</li>
          <li><strong>Le seuil d'escalade</strong> est le pourcentage du temps écoulé à partir duquel le système déclenche une alerte et augmente la priorité (ex: 80% = escalade à 80% du temps écoulé).</li>
          <li>Les vérifications d'escalade sont automatiques toutes les 5 minutes.</li>
          <li>Le SLA est <strong>en pause</strong> quand le ticket passe en statut "En attente client".</li>
        </ul>
      </div>

      {/* Modal d'édition */}
      {editing && (
        <EditPolicyModal
          policy={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

// ============ STAT CARD ============
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

// ============ MODAL : Éditer une politique ============
function EditPolicyModal({ policy, onClose, onSuccess }) {
  const [form, setForm] = useState({
    response_minutes: policy.response_minutes,
    resolution_minutes: policy.resolution_minutes,
    escalation_percent: policy.escalation_percent,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.put(`/api/sla/policies/${policy.id}`, form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            Politique {policy.priority}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Temps de réponse (minutes) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={form.response_minutes}
              onChange={(e) => setForm({ ...form, response_minutes: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              Actuel : {formatMinutes(form.response_minutes)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Temps de résolution (minutes) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={form.resolution_minutes}
              onChange={(e) => setForm({ ...form, resolution_minutes: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              Actuel : {formatMinutes(form.resolution_minutes)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Seuil d'escalade (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={form.escalation_percent}
              onChange={(e) => setForm({ ...form, escalation_percent: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              Le système escalade quand {form.escalation_percent}% du temps est écoulé
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}