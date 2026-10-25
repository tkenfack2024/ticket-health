// ==================== TEMPLATES D'EMAIL ====================

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: auto;
  padding: 24px;
  background: #f8fafc;
`

const cardStyle = `
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e2e8f0;
`

const headerStyle = `
  color: #1e40af;
  font-size: 20px;
  font-weight: bold;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`

const buttonStyle = `
  display: inline-block;
  background: #2563eb;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  margin: 16px 0;
`

const priorityBadge = (priority) => {
  const colors = {
    'Urgente': '#dc2626',
    'Haute': '#ea580c',
    'Moyenne': '#ca8a04',
    'Basse': '#64748b',
  }
  const color = colors[priority] || '#64748b'
  return `<span style="display: inline-block; background: ${color}20; color: ${color}; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${priority}</span>`
}

const priorityBadgeStyle = (priority) => {
  const colors = {
    'Urgente': '#dc2626',
    'Haute': '#ea580c',
    'Moyenne': '#ca8a04',
    'Basse': '#64748b',
  }
  const color = colors[priority] || '#64748b'
  return `display: inline-block; background: ${color}20; color: ${color}; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;`
}

const footer = `
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center;">
    — L'équipe HealthTicket
  </p>
`

// ==================== TEMPLATE : TICKET ASSIGNÉ ====================

export function ticketAssignedEmail({ ticket, assigneeName, ticketUrl }) {
  return {
    subject: `📋 Nouveau ticket #${ticket.id} vous a été assigné : ${ticket.title}`,
    html: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="${headerStyle}">
            🩺 HealthTicket
          </h2>
          <p style="color: #334155; margin-bottom: 16px;">
            Bonjour <strong>${assigneeName}</strong>,
          </p>
          <p style="color: #334155; margin-bottom: 24px;">
            Un nouveau ticket vous a été assigné :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #2563eb;">
            <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
              #${ticket.id} — ${ticket.title}
            </p>
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              <strong>Catégorie :</strong> ${ticket.category}
            </p>
            <p style="margin: 8px 0 0 0;">
              <span style="${priorityBadgeStyle(ticket.priority)}">${ticket.priority}</span>
            </p>
          </div>

          ${ticket.description ? `
            <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">Description :</p>
            <p style="color: #334155; font-size: 14px; background: #f8fafc; padding: 12px; border-radius: 6px; margin: 0 0 16px 0;">
              ${ticket.description.substring(0, 300)}${ticket.description.length > 300 ? '...' : ''}
            </p>
          ` : ''}

          <a href="${ticketUrl}" style="${buttonStyle}">
            Voir le ticket →
          </a>

          ${footer}
        </div>
      </div>
    `,
  }
}

// ==================== TEMPLATE : CHANGEMENT DE STATUT ====================

export function ticketStatusChangedEmail({ ticket, oldStatus, newStatus, ticketUrl }) {
  const statusColors = {
    'Ouvert': '#2563eb',
    'En cours': '#ca8a04',
    'En attente client': '#9333ea',
    'Résolu': '#16a34a',
    'Clos': '#64748b',
  }
  const newColor = statusColors[newStatus] || '#64748b'
  const oldColor = statusColors[oldStatus] || '#64748b'

  return {
    subject: `🔄 Ticket #${ticket.id} : ${oldStatus} → ${newStatus}`,
    html: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="${headerStyle}">
            🩺 HealthTicket
          </h2>
          <p style="color: #334155; margin-bottom: 16px;">
            Bonjour,
          </p>
          <p style="color: #334155; margin-bottom: 24px;">
            Le statut de votre ticket a été modifié :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
              #${ticket.id} — ${ticket.title}
            </p>
            <p style="margin: 16px 0 0 0; font-size: 14px;">
              <span style="background: ${oldColor}20; color: ${oldColor}; padding: 4px 12px; border-radius: 6px; font-weight: 600;">
                ${oldStatus}
              </span>
              <span style="color: #94a3b8; margin: 0 12px;">→</span>
              <span style="background: ${newColor}20; color: ${newColor}; padding: 4px 12px; border-radius: 6px; font-weight: 600;">
                ${newStatus}
              </span>
            </p>
          </div>

          ${newStatus === 'Résolu' ? `
            <p style="color: #16a34a; font-size: 14px; background: #f0fdf4; padding: 12px; border-radius: 6px; border-left: 4px solid #16a34a;">
              ✅ Votre ticket a été résolu. Vous pouvez confirmer la résolution dans le portail.
            </p>
          ` : ''}

          <a href="${ticketUrl}" style="${buttonStyle}">
            Voir le ticket →
          </a>

          ${footer}
        </div>
      </div>
    `,
  }
}

// ==================== TEMPLATE : NOUVEAU COMMENTAIRE ====================

export function newCommentEmail({ ticket, comment, authorName, ticketUrl }) {
  return {
    subject: `💬 Nouveau commentaire sur le ticket #${ticket.id} — ${ticket.title}`,
    html: `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="${headerStyle}">
            🩺 HealthTicket
          </h2>
          <p style="color: #334155; margin-bottom: 16px;">
            Bonjour,
          </p>
          <p style="color: #334155; margin-bottom: 24px;">
            Un nouveau commentaire a été ajouté sur le ticket :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
              #${ticket.id} — ${ticket.title}
            </p>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
              <strong>${authorName}</strong> a écrit :
            </p>
            <p style="margin: 0; color: #334155; font-size: 14px; white-space: pre-line;">
              ${comment.text}
            </p>
          </div>

          <a href="${ticketUrl}" style="${buttonStyle}">
            Répondre →
          </a>

          ${footer}
        </div>
      </div>
    `,
  }
}

// ==================== TEMPLATE : SLA DÉPASSÉ ====================

export function slaExceededEmail({ ticket, slaStatus, deadline, ticketUrl }) {
  return {
    subject: `🚨 SLA ${slaStatus.toUpperCase()} — Ticket #${ticket.id} : ${ticket.title}`,
    html: `
      <div style="${baseStyle}">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px;">
          <h2 style="color: #dc2626; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">
            🚨 ALERTE SLA
          </h2>
          <p style="color: #7f1d1d; margin-bottom: 16px;">
            Le SLA du ticket suivant est <strong>${slaStatus}</strong> :
          </p>

          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
              #${ticket.id} — ${ticket.title}
            </p>
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              <strong>Catégorie :</strong> ${ticket.category}<br>
              <strong>Priorité :</strong> ${ticket.priority}<br>
              <strong>Deadline :</strong> ${deadline}
            </p>
          </div>

                    <a href="${ticketUrl}" style="${buttonStyle}">
            Traiter le ticket →
          </a>
        </div>
      </div>
    `,
  }
}

// ==================== TEMPLATE : CHANGEMENT À APPROUVER ====================

export function changeApprovalRequiredEmail({ change, frontendUrl }) {
  const typeLabels = {
    standard: 'Standard',
    normal: 'Normal',
    emergency: 'Urgence',
  }

  const riskColors = {
    low: '#16a34a',
    medium: '#ca8a04',
    high: '#ea580c',
    critical: '#dc2626',
  }

  const typeColor = change.change_type === 'emergency' ? '#dc2626' : '#2563eb'
  const riskColor = riskColors[change.risk_level] || '#64748b'

  return {
    subject: `🔀 Changement à approuver : RFC #${change.id} — ${change.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e40af; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">
            🩺 HealthTicket
          </h2>

          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1e40af;">
              🔔 Un changement nécessite votre approbation
            </p>
          </div>

          <p style="color: #334155; margin-bottom: 16px;">Bonjour Admin,</p>

          <p style="color: #334155; margin-bottom: 24px;">
            Un nouveau changement a été soumis et est en attente d'approbation :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
              RFC #${change.id} — ${change.title}
            </p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #64748b;">
              <strong>Type :</strong>
              <span style="background: ${typeColor}20; color: ${typeColor}; padding: 2px 8px; border-radius: 4px; font-weight: 600; margin-left: 4px;">
                ${typeLabels[change.change_type] || change.change_type}
              </span>
            </p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #64748b;">
              <strong>Risque :</strong>
              <span style="background: ${riskColor}20; color: ${riskColor}; padding: 2px 8px; border-radius: 4px; font-weight: 600; margin-left: 4px;">
                ${change.risk_level}
              </span>
            </p>
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              <strong>Priorité :</strong> ${change.priority}
            </p>
          </div>

          ${change.description ? `
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
              <p style="margin: 0; color: #334155; font-size: 14px;">
                ${change.description.substring(0, 300)}${change.description.length > 300 ? '...' : ''}
              </p>
            </div>
          ` : ''}

          <a href="${frontendUrl}/admin/changes/${change.id}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px 0;">
            Examiner le changement →
          </a>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center;">
            — L'équipe HealthTicket
          </p>
        </div>
      </div>
    `,
  }
}

// ==================== TEMPLATE : CHANGEMENT APPROUVÉ / REFUSÉ ====================

export function changeDecisionEmail({ change, decision, reason, frontendUrl }) {
  const isApproved = decision === 'approved'
  const color = isApproved ? '#16a34a' : '#dc2626'
  const bgColor = isApproved ? '#f0fdf4' : '#fef2f2'
  const label = isApproved ? '✅ Changement approuvé' : '❌ Changement refusé'

  return {
    subject: `${isApproved ? '✅' : '❌'} RFC #${change.id} ${isApproved ? 'approuvé' : 'refusé'} — ${change.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e40af; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">
            🩺 HealthTicket
          </h2>

          <div style="background: ${bgColor}; border-left: 4px solid ${color}; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${color};">
              ${label}
            </p>
          </div>

          <p style="color: #334155; margin-bottom: 16px;">Bonjour,</p>

          <p style="color: #334155; margin-bottom: 24px;">
            Votre demande de changement a été <strong>${isApproved ? 'approuvée' : 'refusée'}</strong> :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">
              RFC #${change.id} — ${change.title}
            </p>
          </div>

          ${!isApproved && reason ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #991b1b;">Motif :</p>
              <p style="margin: 0; color: #7f1d1d; font-size: 14px;">${reason}</p>
            </div>
          ` : ''}

          <a href="${frontendUrl}/admin/changes/${change.id}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px 0;">
            Voir le changement →
          </a>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center;">
            — L'équipe HealthTicket
          </p>
        </div>
      </div>
    `,
  }
}


// ==================== TEMPLATE : CHANGEMENT RÉALISÉ ====================

export function changeImplementedEmail({ change, frontendUrl }) {
  return {
    subject: `✅ RFC #${change.id} réalisé — ${change.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e40af; font-size: 20px; font-weight: bold; margin: 0 0 16px 0;">
            🩺 HealthTicket
          </h2>

          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #16a34a;">
              ✅ Changement réalisé avec succès
            </p>
          </div>

          <p style="color: #334155; margin-bottom: 16px;">Bonjour,</p>

          <p style="color: #334155; margin-bottom: 24px;">
            Le changement suivant a été implémenté avec succès :
          </p>

          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">
              RFC #${change.id} — ${change.title}
            </p>
          </div>

          <a href="${frontendUrl}/admin/changes/${change.id}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px 0;">
            Voir les détails →
          </a>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center;">
            — L'équipe HealthTicket
          </p>
        </div>
      </div>
    `,
  }
}
