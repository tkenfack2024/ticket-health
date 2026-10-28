// src/pages/admin/PatientsImportExport.jsx
import { useState } from 'react'
import {
  Download, Upload, FileText, Lock, AlertTriangle, CheckCircle,
  Loader2, Users, Eye,
} from 'lucide-react'

export default function AdminPatientsImportExport() {
  const [tab, setTab] = useState('export')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Users size={22} className="text-rose-600" />
          Import / Export Patients
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Sauvegarde et migration chiffrées — conformes RGPD
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'export', label: 'Exporter', icon: Download },
          { id: 'import', label: 'Importer', icon: Upload },
	  { id: 'convert', label: 'Convertir CSV', icon: FileText },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 border-b-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                tab === t.id
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'export' && <ExportTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'convert' && <ConvertTab />}
    </div>
  )
}

// ============ EXPORT ============

function ExportTab() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleExport = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('ht_token')
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/admin/patients/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur export')
      }

      const count = res.headers.get('X-Patient-Count') || '?'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patients-export-${new Date().toISOString().slice(0, 10)}.enc`
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(`${count} patient(s) exporté(s). Conservez le mot de passe en sécurité — il sera nécessaire pour l'import.`)
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Lock size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Le fichier exporté sera chiffré (AES-256-GCM).</strong>
            Vous devrez saisir ce mot de passe lors de l'import. Ne le perdez pas —
            il est impossible de récupérer le fichier sans lui.
          </span>
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleExport} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Mot de passe de chiffrement *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-dark"
            placeholder="Au moins 8 caractères"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Confirmer le mot de passe *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-dark"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-rose-600 text-white py-2.5 rounded-lg hover:bg-rose-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Export en cours...' : 'Exporter les patients'}
        </button>
      </form>
    </div>
  )
}

// ============ IMPORT ============

function ImportTab() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handlePreview = async (e) => {
    e.preventDefault()
    if (!file || !password) return
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', password)

      const token = localStorage.getItem('ht_token')
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/admin/patients/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur aperçu')
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || preview.new_count === 0) return
    setConfirming(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', password)
      formData.append('confirm', 'true')

      const token = localStorage.getItem('ht_token')
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/admin/patients/import/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur import')

      setSuccess(`${data.inserted} patient(s) importé(s) avec succès.`)
      setPreview(null)
      setFile(null)
      setPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Import en 2 étapes :</strong> d'abord un aperçu (aucune modification),
            puis la confirmation (insertion réelle). Les doublons sont détectés et ignorés.
          </span>
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handlePreview} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Fichier chiffré (.enc) *
          </label>
          <input
            type="file"
            required
            accept=".enc"
            onChange={(e) => setFile(e.target.files[0])}
            className="input-dark"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Mot de passe de déchiffrement *
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-dark"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !file || !password}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
          {loading ? 'Analyse...' : 'Prévisualiser l\'import'}
        </button>
      </form>

      {preview && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Aperçu de l'import</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Lignes totales" value={preview.total_lines} color="slate" />
            <StatCard label="Nouveaux" value={preview.new_count} color="green" />
            <StatCard label="Doublons" value={preview.duplicate_count} color="amber" />
            <StatCard label="Erreurs" value={preview.error_count} color="red" />
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-2">Erreurs (max 50 affichées)</p>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                {preview.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {preview.duplicates.length > 0 && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">Doublons ignorés</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
                {preview.duplicates.map((d, i) => (
                  <li key={i}>• {d.last_name} {d.first_name} — {d.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.preview.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Aperçu des {preview.preview.length} premiers nouveaux patients
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="text-left px-2 py-1">Nom</th>
                      <th className="text-left px-2 py-1">Prénom</th>
                      <th className="text-left px-2 py-1">Date naissance</th>
                      <th className="text-left px-2 py-1">Genre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {preview.preview.map((p, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{p.last_name}</td>
                        <td className="px-2 py-1">{p.first_name}</td>
                        <td className="px-2 py-1">{p.dob}</td>
                        <td className="px-2 py-1">{p.gender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleConfirm}
              disabled={confirming || preview.new_count === 0}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {confirming ? 'Import en cours...' : `Confirmer l'import de ${preview.new_count} patient(s)`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

// ============ CONVERT ============

function ConvertTab() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleConvert = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas')
      return
    }
    if (!file) {
      setError('Veuillez sélectionner un fichier CSV')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', password)

      const token = localStorage.getItem('ht_token')
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/admin/patients/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur conversion')
      }

      const count = res.headers.get('X-Patient-Count') || '?'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patients-convertis-${new Date().toISOString().slice(0, 10)}.enc`
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(`${count} patient(s) converti(s) et chiffré(s). Utilisez ce fichier dans l'onglet "Importer".`)
      setFile(null)
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
          <FileText size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Convertissez un fichier CSV en fichier sécurisé (.enc).</strong>
            Le fichier CSV est lu en mémoire et n'est jamais stocké sur le serveur. 
            Le fichier produit est chiffré AES-256-GCM et peut être importé via l'onglet "Importer".
          </span>
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleConvert} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Fichier CSV à convertir *
          </label>
          <input
            type="file"
            required
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="input-dark"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Mot de passe de chiffrement *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-dark"
            placeholder="Au moins 8 caractères"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Confirmer le mot de passe *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-dark"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !file}
          className="w-full bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {loading ? 'Conversion en cours...' : 'Convertir en .enc'}
        </button>
      </form>
    </div>
  )
}