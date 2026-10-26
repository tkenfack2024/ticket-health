import { useState, useEffect } from 'react'
import { Database, Save, Download, Trash2, RefreshCw, CheckCircle, AlertTriangle, Loader2, Server } from 'lucide-react'
import { api } from '../../api'

export default function AdminBackup() {
  const [config, setConfig] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [configData, backupsData] = await Promise.all([
        api.backupGetConfig(),
        api.backupList()
      ])
      setConfig(configData)
      setBackups(backupsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpdateConfig = async (updates) => {
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const newConfig = await api.backupUpdateConfig(updates)
      setConfig(newConfig)
      setSuccessMsg('Configuration mise à jour.')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualBackup = async () => {
    setActionLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await api.backupCreate({})
      setSuccessMsg('Sauvegarde manuelle effectuée avec succès.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette sauvegarde ? Cette action est irréversible.')) return
    try {
      await api.backupDelete(id)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'Ko', 'Mo', 'Go']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400 flex items-center gap-2"><Loader2 className="animate-spin" /> Chargement des sauvegardes...</div>

  return (
    <div className="space-y-6">
      
      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {successMsg && <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2"><CheckCircle size={16}/> {successMsg}</div>}

      {/* Section 1 : Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Server size={20} className="text-blue-600" /> Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Fréquence des sauvegardes automatiques</label>
            <div className="flex gap-2">
              {[3, 6, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => handleUpdateConfig({ interval_hours: h })}
                  disabled={actionLoading || config?.interval_hours === h}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    config?.interval_hours === h
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Statut</label>
            <button
              onClick={() => handleUpdateConfig({ enabled: !config?.enabled })}
              disabled={actionLoading}
              className={`w-full py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                config?.enabled
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}
            >
              {config?.enabled ? '● Activé' : '○ Désactivé'}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
          <p>Dernière sauvegarde : <strong>{config?.last_backup_at || 'Jamais'}</strong></p>
          {config?.last_backup_status === 'failed' && (
            <p className="text-red-500 flex items-center gap-1 mt-1"><AlertTriangle size={14} /> La dernière sauvegarde a échoué.</p>
          )}
        </div>
      </div>

      {/* Section 2 : Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
          <RefreshCw size={20} className="text-blue-600" /> Actions
        </h3>
        <button
          onClick={handleManualBackup}
          disabled={actionLoading}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
        >
          {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
          Lancer une sauvegarde manuelle
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Cela va sauvegarder la base locale et toutes les bases Turso (entreprises).
        </p>
      </div>

      {/* Section 3 : Historique */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database size={20} className="text-blue-600" /> Historique des sauvegardes
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Seules les 3 dernières sauvegardes par base sont conservées automatiquement.</p>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cible</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Taille</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Statut</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {backups.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">Aucune sauvegarde pour le moment.</td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{b.created_at}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      b.type === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {b.type === 'manual' ? 'Manuel' : 'Auto'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {b.tenant_id ? b.tenant_id : 'Local (SQLite)'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatBytes(b.size_bytes)}</td>
                  <td className="px-6 py-4">
                    {b.status === 'success' ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={14}/> Succès</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600" title={b.error_message}><AlertTriangle size={14}/> Échec</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={api.backupDownloadUrl(b.id)}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-1.5 rounded ${b.status === 'success' ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed pointer-events-none'}`}
                        title="Télécharger"
                      >
                        <Download size={16} />
                      </a>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
        <p className="flex items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Note pour la V2 :</strong> La fonctionnalité de restauration (Restore) sera ajoutée dans une prochaine version. Pour l'instant, vous pouvez télécharger les sauvegardes et les conserver en lieu sûr.
          </span>
        </p>
      </div>

    </div>
  )
}