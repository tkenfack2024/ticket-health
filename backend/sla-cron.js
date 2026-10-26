import cron from 'node-cron'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { computeSlaStatus } from './sla.js' // On garde computeSlaStatus

// Différents niveaux d'escalade
const PRIORITY_ESCALATION = {
  'Basse': 'Moyenne',
  'Moyenne': 'Haute',
  'Haute': 'Urgente',
  'Urgente': 'Urgente',
}

export function startSlaCron(db, logAction) {
  cron.schedule('*/5 * * * *', () => {
    runSlaCheck(db, logAction)
  })
  console.log('⏱️  Cron SLA démarré (vérification toutes les 5 minutes)')
  setTimeout(() => runSlaCheck(db, logAction), 30000)
}

async function runSlaCheck(db, logAction) {
  // 1. Vérifier le SQLite local (mode dev)
  try {
    const localTickets = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
      FROM tickets t LEFT JOIN users u ON t.assignee = u.email
      WHERE t.archived = 0 AND t.status NOT IN ('Résolu')
        AND t.sla_escalated = 0 AND t.sla_resolution_deadline IS NOT NULL
        AND t.sla_paused_at IS NULL
    `).all()

    for (const ticket of localTickets) {
      await escalateTicketIfNeeded(db, null, ticket, logAction)
    }
  } catch (err) {
    console.error('Erreur SLA local:', err.message)
  }

  // 2. Vérifier tous les TENANTS Turso
  for (const [tenantId, tenant] of Object.entries(TENANTS)) {
    try {
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      const result = await tursoDb.execute({
        sql: `
          SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
          FROM tickets t LEFT JOIN users u ON t.assignee = u.email
          WHERE t.archived = 0 AND t.status NOT IN ('Résolu')
            AND t.sla_escalated = 0 AND t.sla_resolution_deadline IS NOT NULL
            AND t.sla_paused_at IS NULL
        `
      })

      for (const ticket of result.rows) {
        await escalateTicketIfNeeded(db, tursoDb, ticket, logAction, tenantId)
      }
    } catch (err) {
      console.error(`Erreur SLA Turso (${tenantId}):`, err.message)
    }
  }
}

async function escalateTicketIfNeeded(db, tursoDb, ticket, logAction, tenantId = null) {
  const slaStatus = computeSlaStatus(ticket)
  if (slaStatus !== 'menacé' && slaStatus !== 'dépassé') return

  const oldPriority = ticket.priority
  const newPriority = PRIORITY_ESCALATION[oldPriority] || oldPriority

  const details = slaStatus === 'dépassé'
    ? `SLA DÉPASSÉ — Escalade ${oldPriority} → ${newPriority} (${tenantId || 'local'})`
    : `SLA MENACÉ (80%) — Escalade ${oldPriority} → ${newPriority} (${tenantId || 'local'})`

  // Mise à jour dans la bonne base
  if (tursoDb) {
    await tursoDb.execute({
      sql: `UPDATE tickets SET sla_escalated = 1, priority = ? WHERE id = ?`,
      args: [newPriority, ticket.id]
    })
  } else {
    db.prepare(`UPDATE tickets SET sla_escalated = 1, priority = ? WHERE id = ?`).run(newPriority, ticket.id)
  }

  logAction(null, 'Système (SLA)', 'escalate', 'ticket', ticket.id, details)
  console.log(`🚨 SLA escaladé : Ticket #${ticket.id} (${tenantId || 'local'})`)

  // Envoi email si assigné
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
      console.error('Erreur email escalade:', err.message)
    }
  }
}