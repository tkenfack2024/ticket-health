// src/components/Nis2Countdown.jsx
// Compte à rebours réglementaire NIS2 — 3 échéances :
// - Early Warning (24h)
// - Notification (72h)
// - Final Report (1 mois = 30 jours)
import { useState, useEffect } from 'react'
import {
  ShieldAlert, Clock, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

// ==================== CONFIGURATION DES ÉCHÉANCES ====================

const NIS2_DEADLINES = [
  {
    key: 'early_warning',
    column: 'nis2_early_warning_at',
    label: 'Alerte précoce (Early Warning)',
    description: 'Notification initiale à l\'ANSSI/CSIRT sous 24h',
    hoursLimit: 24,
    icon: '🟢',
  },
  {
    key: 'notification',
    column: 'nis2_notification_at',
    label: 'Notification formelle',
    description: 'Notification détaillée de l\'incident sous 72h',
    hoursLimit: 72,
    icon: '🟠',
  },
  {
    key: 'final_report',
    column: 'nis2_final_report_at',
    label: 'Rapport final',
    description: 'Rapport complet et analyse post-incident sous 1 mois (30 jours)',
    hoursLimit: 24 * 30,
    icon: '🔴',
  },
]

// ==================== HELPERS DE FORMATAGE ====================

function formatDuration(ms) {
  if (ms < 0) ms = Math.abs(ms)
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}j ${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// Convertit "YYYY-MM-DD HH:MM:SS" (SQLite) en objet Date valide
function parseSqliteDate(dateStr) {
  if (!dateStr) return null
  try {
    const iso = dateStr.replace(' ', 'T')
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// ==================== COMPOSANT PRINCIPAL ====================

export default function Nis2Countdown({ ticket, onUpdate }) {
  const { hasPermission, isAdmin } = useAuth()
  const [now, setNow] = useState(new Date())
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState(null)

  // Rafraîchit le compte à rebours toutes les minutes
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // N'affiche rien si le ticket n'est pas un incident NIS2 majeur
  const isNis2Incident = ticket?.is_dora_major === 1 || ticket?.incident_type === 'major'
  if (!isNis2Incident) return null

  // Date de référence = date de création du ticket
  const referenceDate = parseSqliteDate(ticket.created_at)
  if (!referenceDate) return null

  // Peut-on marquer comme envoyé ? (admin ou permission tickets.classify)
  const canEdit = isAdmin || hasPermission('tickets.classify')

  // ==================== ACTION : MARQUER COMME ENVOYÉ ====================

  const handleMarkSent = async (column) => {
    if (!canEdit) return
    if (!confirm('Confirmer que cette échéance a bien été envoyée à l\'autorité compétente ?')) return

    setUpdating(column)
    setError(null)
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await api.updateTicket(ticket.id, { [column]: nowStr })
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  // ==================== ACTION : ANNULER L'ENVOI ====================

  const handleUnmarkSent = async (column) => {
    if (!canEdit) return
    if (!confirm('Annuler le marquage "envoyé" de cette échéance ?')) return

    setUpdating(column)
    setError(null)
    try {
      // On met une chaîne vide qui sera interprétée comme NULL côté backend via COALESCE
      // Attention : le backend utilise COALESCE(?, col) donc on ne peut pas remettre à NULL ainsi.
      // Solution : envoyer une valeur sentinelle ne fonctionne pas. On laisse cette option de côté.
      // Pour annuler, il faut modifier côté backend. On ne propose donc que le marquage.
      alert('L\'annulation nécessite une modification backend. Contactez l\'administrateur.')
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  // ==================== RENDU ====================

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
      {/* Bandeau titre */}
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert size={22} className="text-red-600 dark:text-red-400" />
        <h2 className="font-bold text-red-900 dark:text-red-200 text-lg">
          Incident NIS2 — Compte à rebours réglementaire
        </h2>
      </div>

      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
        Directive NIS2 (UE) 2022/2555 — 3 échéances obligatoires à compter de la date de création du ticket
        (<strong>{formatDateTime(ticket.created_at)}</strong>).
      </p>

      {error && (
        <div className="mb-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 3 compteurs */}
      <div className="space-y-3">
        {NIS2_DEADLINES.map((deadline) => {
          const deadlineDate = new Date(referenceDate.getTime() + deadline.hoursLimit * 3600_000)
          const alreadySent = !!ticket[deadline.column]
          const remainingMs = deadlineDate.getTime() - now.getTime()
          const remainingHours = remainingMs / 3600_000
          const percentLeft = (remainingHours / deadline.hoursLimit) * 100

          // Détermination de l'état visuel
          let state = 'ok' // ok | warning | critical | sent | overdue
          if (alreadySent) state = 'sent'
          else if (remainingMs <= 0) state = 'overdue'
          else if (percentLeft < 25) state = 'critical'
          else if (percentLeft < 50) state = 'warning'

          // Classes Tailwind explicites (pas de dynamique)
          const stateStyles = {
            ok: {
              container: 'bg-white dark:bg-slate-800 border-green-200 dark:border-green-800',
              badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              text: 'text-green-700 dark:text-green-400',
              icon: '🟢',
              label: 'Temps restant',
            },
            warning: {
              container: 'bg-white dark:bg-slate-800 border-orange-200 dark:border-orange-800',
              badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
              text: 'text-orange-700 dark:text-orange-400',
              icon: '🟠',
              label: 'Attention',
            },
            critical: {
              container: 'bg-white dark:bg-slate-800 border-red-300 dark:border-red-800',
              badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              text: 'text-red-700 dark:text-red-400',
              icon: '🔴',
              label: 'Critique',
            },
            overdue: {
              container: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-700',
              badge: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
              text: 'text-red-800 dark:text-red-300',
              icon: '🚨',
              label: 'DÉPASSÉ',
            },
            sent: {
              container: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
              badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
              text: 'text-slate-600 dark:text-slate-400',
              icon: '✅',
              label: 'Envoyé',
            },
          }
          const styles = stateStyles[state]

          return (
            <div
              key={deadline.key}
              className={`rounded-lg border-l-4 border p-4 ${styles.container}`}
              style={{
                borderLeftColor:
                  state === 'sent' ? '#94a3b8' :
                  state === 'overdue' ? '#dc2626' :
                  state === 'critical' ? '#ef4444' :
                  state === 'warning' ? '#f59e0b' : '#10b981',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* Infos gauche */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg">{styles.icon}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {deadline.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
                      {deadline.hoursLimit < 24
                        ? `${deadline.hoursLimit}h`
                        : deadline.hoursLimit < 24 * 30
                          ? `${deadline.hoursLimit / 24}j`
                          : `${Math.round(deadline.hoursLimit / 24 / 30)} mois`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {deadline.description}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Échéance : <strong>{formatDateTime(deadlineDate.toISOString())}</strong>
                  </p>
                </div>

                {/* Compteur droite */}
                <div className="flex flex-col md:items-end gap-2 md:flex-shrink-0">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${styles.text}`}>
                      {alreadySent ? (
                        <>
                          <CheckCircle size={16} className="inline mr-1" />
                          Envoyé le {formatDateTime(ticket[deadline.column])}
                        </>
                      ) : remainingMs <= 0 ? (
                        <>
                          <AlertTriangle size={16} className="inline mr-1" />
                          Dépassé de {formatDuration(remainingMs)}
                        </>
                      ) : (
                        <>
                          <Clock size={16} className="inline mr-1" />
                          {formatDuration(remainingMs)} restantes
                        </>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {styles.label}
                    </p>
                  </div>

                  {/* Bouton action */}
                  {!alreadySent && canEdit && (
                    <button
                      onClick={() => handleMarkSent(deadline.column)}
                      disabled={updating === deadline.column}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating === deadline.column ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle size={12} />
                      )}
                      Marquer comme envoyé
                    </button>
                  )}

                  {alreadySent && canEdit && (
                    <button
                      onClick={() => handleUnmarkSent(deadline.column)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      Annuler l'envoi
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info bas de bloc */}
      <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
        💡 Le compte à rebours démarre à la <strong>date de création du ticket</strong>. Une fois une échéance
        marquée comme envoyée, elle ne peut plus être décomptée (mais reste visible pour l'audit).
      </div>
    </div>
  )
}