import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== CRITÈRES DORA ====================

export const DORA_CRITERIA = [
  { id: 'clients_affected', label: 'Nombre de clients affectés', description: 'Plus de 10% des clients ou 100 000+ clients', threshold: '10% ou 100000' },
  { id: 'duration', label: 'Durée de l\'incident', description: 'Plus de 2 heures de dysfonctionnement', threshold: '2h' },
  { id: 'data_loss', label: 'Perte de données', description: 'Perte, altération ou divulgation de données', threshold: 'oui' },
  { id: 'geographic', label: 'Impact géographique', description: 'Au moins 2 États membres de l\'UE', threshold: '2+' },
  { id: 'critical_services', label: 'Services critiques', description: 'Impact sur des services critiques ou importants', threshold: 'oui' },
  { id: 'economic_impact', label: 'Impact économique', description: 'Coût estimé > 100 000 €', threshold: '>100k€' },
  { id: 'reputation', label: 'Impact réputationnel', description: 'Couverture médiatique ou atteinte à la réputation', threshold: 'oui' },
]

export function evaluateDoraMajor(criteria) {
  if (!criteria || typeof criteria !== 'object') return false
  const checkedCount = Object.values(criteria).filter(v => v === true).length
  return checkedCount >= 2
}

function getNotificationDeadline(createdAt) {
  const created = new Date(createdAt)
  const deadline = new Date(created.getTime() + 4 * 60 * 60 * 1000)
  return deadline.toISOString()
}

// ==================== ROUTES ====================

export function createIncidentsRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/incidents/criteria ----
  router.get('/criteria', (req, res) => {
    res.json(DORA_CRITERIA)
  })

  // ---- GET /api/incidents/major ----
  router.get('/major', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT t.*, u.name as assigned_to_name
          FROM tickets t
          LEFT JOIN users u ON t.assignee = u.email
          WHERE t.is_dora_major = 1
          ORDER BY t.created_at DESC
        `)
        const enriched = result.rows.map(i => ({
          ...i,
          dora_criteria_parsed: i.dora_criteria ? JSON.parse(i.dora_criteria) : {},
        }))
        return res.json(enriched)
      } catch (err) {
        console.error('Erreur Turso GET major incidents:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const incidents = db.prepare(`
      SELECT t.*, u.name as assigned_to_name
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      WHERE t.is_dora_major = 1
      ORDER BY t.created_at DESC
    `).all()

    const enriched = incidents.map(i => ({
      ...i,
      dora_criteria_parsed: i.dora_criteria ? JSON.parse(i.dora_criteria) : {},
    }))
    res.json(enriched)
  })

  // ---- GET /api/incidents/stats ----
  router.get('/stats', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const totalResult = await tursoDb.execute('SELECT COUNT(*) as c FROM tickets WHERE archived = 0')
        const securityResult = await tursoDb.execute("SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND incident_type = 'security'")
        const majorResult = await tursoDb.execute('SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND is_dora_major = 1')
        const standardResult = await tursoDb.execute("SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND incident_type = 'standard'")
        const majorLast30Result = await tursoDb.execute(`
          SELECT COUNT(*) as c FROM tickets
          WHERE is_dora_major = 1 AND created_at >= datetime('now', '-30 days', 'localtime')
        `)
        const byMonthResult = await tursoDb.execute(`
          SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
          FROM tickets
          WHERE is_dora_major = 1 AND created_at >= datetime('now', '-6 months', 'localtime')
          GROUP BY month ORDER BY month DESC
        `)

        return res.json({
          total: totalResult.rows[0].c,
          standard: standardResult.rows[0].c,
          security: securityResult.rows[0].c,
          major: majorResult.rows[0].c,
          major_last_30_days: majorLast30Result.rows[0].c,
          major_by_month: byMonthResult.rows,
        })
      } catch (err) {
        console.error('Erreur Turso GET incident stats:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const total = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE archived = 0').get().c
    const security = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND incident_type = 'security'").get().c
    const major = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND is_dora_major = 1').get().c
    const standard = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE archived = 0 AND incident_type = 'standard'").get().c
    const majorLast30 = db.prepare(`
      SELECT COUNT(*) as c FROM tickets
      WHERE is_dora_major = 1 AND created_at >= datetime('now', '-30 days', 'localtime')
    `).get().c
    const byMonth = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM tickets
      WHERE is_dora_major = 1 AND created_at >= datetime('now', '-6 months', 'localtime')
      GROUP BY month ORDER BY month DESC
    `).all()

    res.json({
      total, standard, security, major,
      major_last_30_days: majorLast30,
      major_by_month: byMonth,
    })
  })

  // ---- GET /api/incidents/:id/notification ----
  router.get('/:id/notification', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `
            SELECT t.*, u.name as assigned_to_name,
                   creator_user.name as creator_name, creator_user.email as creator_email
            FROM tickets t
            LEFT JOIN users u ON t.assignee = u.email
            LEFT JOIN users creator_user ON t.created_by = creator_user.id
            WHERE t.id = ?
          `,
          args: [req.params.id]
        })
        const ticket = result.rows[0]
        if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })
        if (!ticket.is_dora_major) return res.status(400).json({ error: 'Ce ticket n\'est pas classifié comme incident DORA majeur' })

        const criteria = ticket.dora_criteria ? JSON.parse(ticket.dora_criteria) : {}

        const notification = {
          incident_reference: `HT-${ticket.id}-${new Date(ticket.created_at).getFullYear()}`,
          title: ticket.title,
          description: ticket.description,
          severity: 'major',
          classification: 'dora',
          detected_at: ticket.created_at,
          reported_at: new Date().toISOString(),
          reporter: {
            name: ticket.creator_name || ticket.creator,
            email: ticket.creator_email,
          },
          affected_services: [ticket.category],
          criteria_met: Object.entries(criteria).filter(([_, v]) => v === true).map(([k]) => k),
          criteria_details: DORA_CRITERIA.filter(c => criteria[c.id] === true),
          status: ticket.status,
          assigned_to: ticket.assigned_to_name,
          notification_required: true,
          notification_deadline: getNotificationDeadline(ticket.created_at),
        }
        return res.json(notification)
      } catch (err) {
        console.error('Erreur Turso GET notification:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ticket = db.prepare(`
      SELECT t.*, u.name as assigned_to_name,
             creator_user.name as creator_name, creator_user.email as creator_email
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      LEFT JOIN users creator_user ON t.created_by = creator_user.id
      WHERE t.id = ?
    `).get(req.params.id)

    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })
    if (!ticket.is_dora_major) return res.status(400).json({ error: 'Ce ticket n\'est pas classifié comme incident DORA majeur' })

    const criteria = ticket.dora_criteria ? JSON.parse(ticket.dora_criteria) : {}

    const notification = {
      incident_reference: `HT-${ticket.id}-${new Date(ticket.created_at).getFullYear()}`,
      title: ticket.title,
      description: ticket.description,
      severity: 'major',
      classification: 'dora',
      detected_at: ticket.created_at,
      reported_at: new Date().toISOString(),
      reporter: {
        name: ticket.creator_name || ticket.creator,
        email: ticket.creator_email,
      },
      affected_services: [ticket.category],
      criteria_met: Object.entries(criteria).filter(([_, v]) => v === true).map(([k]) => k),
      criteria_details: DORA_CRITERIA.filter(c => criteria[c.id] === true),
      status: ticket.status,
      assigned_to: ticket.assigned_to_name,
      notification_required: true,
      notification_deadline: getNotificationDeadline(ticket.created_at),
    }
    res.json(notification)
  })

  return router
}