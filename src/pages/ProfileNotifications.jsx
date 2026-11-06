import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, Save, Loader2, CheckCircle, AlertTriangle, Monitor, Mail, Shield, Key } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const NOTIFICATION_TYPES = [
  { key: 'notify_ticket_assigned', label: 'Ticket assigné', description: 'Recevoir un email quand un ticket vous est assigné', icon: '📋' },
  { key: 'notify_status_changed', label: 'Changement de statut', description: 'Recevoir un email quand le statut d\'un de vos tickets change', icon: '🔄' },
  { key: 'notify_new_comment', label: 'Nouveau commentaire', description: 'Recevoir un email quand un commentaire est ajouté sur un de vos tickets', icon: '💬' },
  { key: 'notify_sla_exceeded', label: 'Alerte SLA', description: 'Recevoir un email quand un SLA est dépassé (ne peut pas être désactivé pour les techniciens/admins)', icon: '🚨', disabled: true },
]

export default function ProfileNotifications() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('preferences')
  
  return (
    <div className="p-8 max-w-4xl">
      <Link to="/" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6">
        <ArrowLeft size={18} /> Retour
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Bell size={26} className="text-blue-600 dark:text-blue-400" />
          Mon Profil
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Gérez vos préférences et la sécurité de votre compte
        </p>
      </div>

      {/* Onglets horizontaux */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'preferences'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Mail size={16} /> Préférences de notification
        </button>
        <button
          onClick={() => setActiveTab('windows')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'windows'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Monitor size={16} /> Windows notification
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Shield size={16} /> Sécurité (MFA)
        </button>
      </div>

      {/* Contenu */}
      {activeTab === 'preferences' && <PreferencesTab />}
      {activeTab === 'windows' && <WindowsTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  )
}

// ============ ONGLET PRÉFÉRENCES (Emails) ============
function PreferencesTab() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.get('/api/notifications/preferences')
      setPrefs(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (key) => {
    setPrefs({ ...prefs, [key]: prefs[key] === 1 ? 0 : 1 })
    setSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const payload = {}
      for (const type of NOTIFICATION_TYPES) {
        payload[type.key] = prefs[type.key] === 1
      }
      await api.patch('/api/notifications/preferences', payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-slate-500 dark:text-slate-400">Chargement...</div>
  if (!prefs) return <div className="text-red-600">Erreur de chargement</div>

  return (
    <div>
      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2"><CheckCircle size={16} /> Préférences enregistrées</div>}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {NOTIFICATION_TYPES.map((type, index) => {
          const isEnabled = prefs[type.key] === 1
          const isDisabled = type.disabled && (user?.role === 'admin' || user?.role === 'technicien')

          return (
            <div key={type.key} className={`p-4 flex items-center justify-between gap-4 ${index < NOTIFICATION_TYPES.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
              <div className="flex items-start gap-3 flex-1">
                <div className="text-2xl">{type.icon}</div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{type.label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{type.description}</p>
                  {isDisabled && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Non désactivable pour les {user.role}s</p>}
                </div>
              </div>
              <button
                onClick={() => !isDisabled && handleToggle(type.key)}
                disabled={isDisabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  isDisabled ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed' :
                  isEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer les préférences
        </button>
      </div>
    </div>
  )
}

// ============ ONGLET WINDOWS (Notifications système) ============
function WindowsTab() {
  const [notifEnabled, setNotifEnabled] = useState(
    localStorage.getItem('ht_notifications_enabled') === 'true'
  )

  const handleToggle = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert("Votre navigateur ne supporte pas les notifications système.");
      return;
    }

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        localStorage.setItem('ht_notifications_enabled', 'true')
        setNotifEnabled(true)
        new Notification('HealthTicket', { body: 'Notifications Windows activées !' })
      }
    } else {
      const current = localStorage.getItem('ht_notifications_enabled') === 'true'
      const newValue = !current
      localStorage.setItem('ht_notifications_enabled', String(newValue))
      setNotifEnabled(newValue)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <Monitor size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Notifications système Windows</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
              Recevez des alertes sur votre bureau lorsqu'un ticket vous est assigné ou qu'un statut change.
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0 ${notifEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}

// ============ ONGLET SÉCURITÉ (MFA) ============
function SecurityTab() {
  const { user, isAdmin } = useAuth()
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/auth/mfa/status')
      .then(res => {
        setIsEnabled(res.enabled)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-slate-500">Chargement...</div>

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${isEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
          <Shield size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            Authentification à deux facteurs (MFA)
          </h3>
          <div className="mt-2">
            {isEnabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle size={12} /> Activé
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                Désactivé
              </span>
            )}
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
            {isEnabled 
              ? "Votre compte est protégé par un code à 6 chiffres généré par votre téléphone." 
              : "Ajoutez une couche de sécurité supplémentaire à votre compte."}
          </p>

          <div className="mt-6">
            {isEnabled ? (
              isAdmin ? (
                <Link to="/profile/security" className="text-sm text-blue-600 hover:underline">
                  Gérer mon MFA (désactiver)
                </Link>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  ⚠️ Seul un administrateur peut désactiver votre MFA. Contactez le support si vous avez perdu votre téléphone.
                </p>
              )
            ) : (
              <Link to="/profile/security" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                <Key size={16} /> Activer le MFA
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}