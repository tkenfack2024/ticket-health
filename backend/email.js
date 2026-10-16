import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendOTPEmail(to, code, userName) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #1e40af; margin: 0 0 16px;">HealthTicket</h2>
      <p>Bonjour ${userName || 'Utilisateur'},</p>
      <p>Voici votre code de connexion :</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #1e40af; background: #eff6ff; padding: 16px; border-radius: 8px; margin: 24px 0;">
        ${code}
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Ce code est valable ${process.env.OTP_EXPIRES_IN_MINUTES || 5} minutes.<br>
        Si vous n'avez pas demandé ce code, ignorez cet email.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        — L'équipe HealthTicket
      </p>
    </div>
  `

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Votre code de connexion HealthTicket',
    html,
  })
}

export async function testEmailConnection() {
  try {
    await transporter.verify()
    console.log('✅ Connexion email OK')
    return true
  } catch (err) {
    console.error('❌ Erreur connexion email :', err.message)
    return false
  }
}

export async function sendSlaAlertEmail(to, userName, ticket, slaStatus, oldPriority, newPriority) {
  const statusLabel = slaStatus === 'dépassé' ? '🔴 SLA DÉPASSÉ' : '⚠️ SLA MENACÉ'
  const statusColor = slaStatus === 'dépassé' ? '#dc2626' : '#f59e0b'
  const statusBg = slaStatus === 'dépassé' ? '#fef2f2' : '#fffbeb'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #1e40af; margin: 0 0 16px;">HealthTicket</h2>

      <div style="background: ${statusBg}; border-left: 4px solid ${statusColor}; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${statusColor};">
          ${statusLabel}
        </p>
      </div>

      <p>Bonjour ${userName || 'Technicien'},</p>

      <p>Un ticket qui vous est assigné nécessite votre attention immédiate :</p>

      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #0f172a;">
          #${ticket.id} — ${ticket.title}
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
          Catégorie : <strong>${ticket.category}</strong>
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Priorité précédente :</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${oldPriority}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nouvelle priorité :</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right; color: ${statusColor};">${newPriority}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Deadline SLA :</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${ticket.sla_resolution_deadline}</td>
        </tr>
      </table>

      <p style="color: #64748b; font-size: 14px;">
        Connectez-vous à HealthTicket pour traiter ce ticket en priorité.
      </p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        — L'équipe HealthTicket
      </p>
    </div>
  `

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: `🚨 [SLA ${slaStatus.toUpperCase()}] Ticket #${ticket.id} — ${ticket.title}`,
    html,
  })
}