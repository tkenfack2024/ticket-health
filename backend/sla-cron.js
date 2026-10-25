import cron from 'node-cron'
import { computeSlaStatus, getSlaPolicy } from './sla.js'

// Différents niveaux d'escalade
const PRIORITY_ESCALATION = {
  'Basse': 'Moyenne',
  'Moyenne': 'Haute',
  'Haute': 'Urgente',
  'Urgente': 'Urgente', // ne peut pas monter plus
}

export function startSlaCron(db, logAction) {
  // Exécuter toutes les 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runSlaCheck(db, logAction)
  })

  console.log('⏱️  Cron SLA démarré (toutes les 5 minutes)')

  // Exécuter une première fois après 30 secondes (pour tester)
  setTimeout(() => runSlaCheck(db, logAction), 30000)
}

async function runSlaCheck(db, logAction) {
  try {
    // Chercher tous les tickets ouverts avec SLA et non encore escaladés
    const tickets = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      WHERE t.archived = 0
        AND t.status NOT IN ('Résolu')
        AND t.sla_escalated = 0
        AND t.sla_resolution_deadline IS NOT NULL
        AND t.sla_paused_at IS NULL
    `).all()

    if (tickets.length === 0) return

    let escalatedCount = 0

    for (const ticket of tickets) {
      const slaStatus = computeSlaStatus(ticket)

      // Escalader si 'menacé' (80%+) OU 'dépassé'
      if (slaStatus !== 'menacé' && slaStatus !== 'dépassé') continue

      // Monter d'un cran la priorité (sauf si déjà Urgente)
      const oldPriority = ticket.priority
      const newPriority = PRIORITY_ESCALATION[oldPriority] || oldPriority
      const priorityChanged = newPriority !== oldPriority

      // Mettre à jour le ticket
      db.prepare(`
        UPDATE tickets
        SET sla_escalated = 1,
            priority = ?
        WHERE id = ?
      `).run(newPriority, ticket.id)

      // Log
      const details = slaStatus === 'dépassé'
        ? `SLA DÉPASSÉ — Escalade ${oldPriority} → ${newPriority}`
        : `SLA MENACÉ (80%) — Escalade ${oldPriority} → ${newPriority}`
      logAction(null, 'Système (SLA)', 'escalate', 'ticket', ticket.id, details)

      // Envoyer email si un technicien est assigné
      if (ticket.assigned_to_email) {
        try {
          const { sendSlaAlertEmail } = await import('./email.js')
          await sendSlaAlertEmail(
            ticket.assigned_to_email,
            ticket.assigned_to_name,
            ticket,
            slaStatus,
            oldPriority,
            newPriority
          )
        } catch (err) {
          console.error('Erreur envoi email escalade:', err.message)
        }
      }

      escalatedCount++
      console.log(`🚨 SLA escaladé : Ticket #${ticket.id} "${ticket.title}" (${oldPriority} → ${newPriority})`)
    }

    if (escalatedCount > 0) {
      console.log(`⏱️  SLA check : ${escalatedCount} ticket(s) escaladé(s)`)
    }
  } catch (err) {
    console.error('Erreur cron SLA :', err)
  }
}

// Fonction pour lancer un check manuel (utile pour tester)
export function runSlaCheckNow(db, logAction) {
  return runSlaCheck(db, logAction)
}