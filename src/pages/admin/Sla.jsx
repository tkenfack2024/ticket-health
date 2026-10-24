import { useState, useEffect } from 'react'
import { Save, Download, X, Loader2, Clock, AlertTriangle, CheckCircle, Timer } from 'lucide-react'
import { api } from '../../api'

const PRIORITY_COLORS = {
  Urgente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Haute: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Moyenne: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Basse: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
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

  const handleExport = () => window.open(`http://localhost:3001/api/sla/export?token=${localStorage.getItem('ht_token')}`, '_blank')

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Politiques SLA</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Configurez les engagements de temps de réponse et de résolution</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
          <Download size={16} />
          Exporter rapport CSV
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Conformité</p>
                <p className={`text-2xl font-bold mt-1 ${
                  stats.respect_rate >= 90 ? 'text-green-700 dark:text-green-400' :
                  stats.respect_rate >= 70 ? 'text-amber-700 dark:text-amber-400' :
                  'text-red-700 dark:text-red-400'
                }`}>{stats.respect_rate}%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stats.respected} / {stats.respected + stats.threatened + stats.exceeded} tickets</p>
              </div>
              <div className={`p-3 rounded-lg ${
                stats.respect_rate >= 90 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                stats.respect_rate >= 70 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
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
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle size={20} /></div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Dépassés</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{stats.exceeded}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">hors délai</p>
              </div>
              <div className="p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle size={20} /></div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">MTTR</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{formatMinutes(stats.mttr_minutes)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">temps moyen</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Timer size={20} /></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Priorité</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Temps de réponse</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Temps de résolution</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Seuil escalade</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {policies.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[p.priority] || ''}`}>{p.priority}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatMinutes(p.response_minutes)}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-medium">{formatMinutes(p.resolution_minutes)}</td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{p.escalation_percent}%</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium">Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 text-sm mb-2">💡 Comment ça marche ?</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li><strong>Le temps de réponse</strong> est le délai maximum pour qu'un technicien prenne le ticket en charge.</li>
          <li><strong>Le temps de résolution</strong> est le délai maximum pour résoudre complètement le ticket.</li>
          <li><strong>Le seuil d'escalade</strong> est le pourcentage du temps écoulé à partir duquel le système déclenche une alerte.</li>
          <li>Le SLA est <strong>en pause</strong> quand le ticket est en "En attente client".</li>
        </ul>
      </div>

      {editing && <EditPolicyModal policy={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); load() }} />}
    </div>
  )
}

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock size={18} className="text-blue-600 dark:text-blue-400" />
            Politique {policy.priority}
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Temps de réponse (min) *</label>
            <input type="number" min="1" required value={form.response_minutes} onChange={(e) => setForm({ ...form, response_minutes: parseInt(e.target.value) || 0 })} className="input-dark" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Actuel : {formatMinutes(form.response_minutes)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Temps de résolution (min) *</label>
            <input type="number" min="1" required value={form.resolution_minutes} onChange={(e) => setForm({ ...form, resolution_minutes: parseInt(e.target.value) || 0 })} className="input-dark" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Actuel : {formatMinutes(form.resolution_minutes)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seuil d'escalade (%)</label>
            <input type="number" min="1" max="100" required value={form.escalation_percent} onChange={(e) => setForm({ ...form, escalation_percent: parseInt(e.target.value) || 0 })} className="input-dark" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Escalade quand {form.escalation_percent}% du temps est écoulé</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}