import { sendNotificationEmail } from './email.js'
import {
  ticketAssignedEmail,
  ticketStatusChangedEmail,
  newCommentEmail,
  slaExceededEmail,
} from './email-templates.js'

// ==================== HELPERS ====================

/**
 * Vérifie si un user veut recevoir un type de notification
 */
export function wantsNotification(db, userId, type) {
  const prefs = db.prepare(`
    SELECT notify_ticket_assigned, notify_status_changed, notify_new_comment, notify_sla_exceeded
    FROM user_notifications_preferences
    WHERE user_id = ?
  `).get(userId)

  // Pas de préférence = tout activé par défaut
  if (!prefs) return true

  const map = {
    ticket_assigned: prefs.notify_ticket_assigned === 1,
    status_changed: prefs.notify_status_changed === 1,
    new_comment: prefs.notify_new_comment === 1,
    sla_exceeded: prefs.notify_sla_exceeded === 1,
  }

  return map[type] !== false
}

/**
 * Envoie une notification si l'utilisateur le veut
 */
export async function sendIfWanted(db, userId, type, emailData) {
  if (!wantsNotification(db, userId, type)) {
    console.log(`🔕 Notification ${type} désactivée pour user ${userId}`)
    return false
  }

  return await sendNotificationEmail(emailData.to, emailData.subject, emailData.html)
}

// ==================== NOTIFICATIONS SPÉCIFIQUES ====================

/**
 * Notifie un technicien qu'un ticket lui a été assigné
 */
export async function notifyTicketAssigned(db, ticket, assigneeEmail, frontendUrl) {
  if (!assigneeEmail || assigneeEmail === '-') return false

  const assignee = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(assigneeEmail)
  if (!assignee || !assignee.email) return false

  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`
  const template = ticketAssignedEmail({
    ticket,
    assigneeName: assignee.name,
    ticketUrl,
  })

  return await sendIfWanted(db, assignee.id, 'ticket_assigned', {
    to: assignee.email,
    subject: template.subject,
    html: template.html,
  })
}

/**
 * Notifie le créateur qu'un ticket a changé de statut
 */
export async function notifyStatusChanged(db, ticket, oldStatus, newStatus, frontendUrl) {
  const creator = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(ticket.created_by)
  if (!creator || !creator.email) return false

  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`
  const template = ticketStatusChangedEmail({
    ticket,
    oldStatus,
    newStatus,
    ticketUrl,
  })

  return await sendIfWanted(db, creator.id, 'status_changed', {
    to: creator.email,
    subject: template.subject,
    html: template.html,
  })
}

/**
 * Notifie les parties concernées d'un nouveau commentaire
 */
export async function notifyNewComment(db, ticket, comment, authorUserId, authorName, frontendUrl) {
  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`
  const template = newCommentEmail({
    ticket,
    comment,
    authorName,
    ticketUrl,
  })

  // Récupérer créateur + assigné
  const creator = ticket.created_by
    ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(ticket.created_by)
    : null
  const assignee = ticket.assignee && ticket.assignee !== '-'
    ? db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(ticket.assignee)
    : null

  const recipients = []
  if (creator && creator.id !== authorUserId && creator.email) {
    recipients.push(creator)
  }
  if (assignee && assignee.id !== authorUserId && assignee.email) {
    recipients.push(assignee)
  }

  for (const recipient of recipients) {
    await sendIfWanted(db, recipient.id, 'new_comment', {
      to: recipient.email,
      subject: template.subject,
      html: template.html,
    })
  }

  return recipients.length
}

/**
 * Notifie une alerte SLA (toujours envoyée, non désactivable)
 */
export async function notifySlaExceeded(db, ticket, slaStatus, deadline, frontendUrl) {
  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`
  const template = slaExceededEmail({
    ticket,
    slaStatus,
    deadline,
    ticketUrl,
  })

  const recipients = new Set()

  // 1. Assigné
  if (ticket.assignee && ticket.assignee !== '-') {
    const assignee = db.prepare('SELECT email FROM users WHERE email = ?').get(ticket.assignee)
    if (assignee && assignee.email) recipients.add(assignee.email)
  }

  // 2. Tous les admins
  const admins = db.prepare('SELECT email FROM users WHERE role = ? AND active = 1').all('admin')
  for (const admin of admins) {
    if (admin.email) recipients.add(admin.email)
  }

  // Envoi (non désactivable)
  let count = 0
  for (const email of recipients) {
    await sendNotificationEmail(email, template.subject, template.html)
    count++
  }

  return count
}

/**
 * Récupère les préférences d'un user (ou les crée par défaut)
 */
export function getPreferences(db, userId) {
  let prefs = db.prepare('SELECT * FROM user_notifications_preferences WHERE user_id = ?').get(userId)

  if (!prefs) {
    db.prepare('INSERT INTO user_notifications_preferences (user_id) VALUES (?)').run(userId)
    prefs = db.prepare('SELECT * FROM user_notifications_preferences WHERE user_id = ?').get(userId)
  }

  return prefs
}

/**
 * Met à jour les préférences d'un user
 */
export function updatePreferences(db, userId, updates) {
  getPreferences(db, userId) // S'assurer que la ligne existe

  const allowed = ['notify_ticket_assigned', 'notify_status_changed', 'notify_new_comment', 'notify_sla_exceeded']
  const fields = []
  const values = []

  for (const field of allowed) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`)
      values.push(updates[field] ? 1 : 0)
    }
  }

  if (fields.length === 0) return getPreferences(db, userId)

  fields.push('updated_at = datetime(\'now\', \'localtime\')')
  values.push(userId)

  db.prepare(`UPDATE user_notifications_preferences SET ${fields.join(', ')} WHERE user_id = ?`).run(...values)

  return getPreferences(db, userId)
}