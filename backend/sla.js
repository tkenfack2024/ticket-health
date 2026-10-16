import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'

// ==================== CONSTANTES ====================

export const SLA_DEFAULTS = [
  { priority: 'Urgente', response_minutes: 15, resolution_minutes: 120, escalation_percent: 80 },
  { priority: 'Haute', response_minutes: 30, resolution_minutes: 480, escalation_percent: 80 },
  { priority: 'Moyenne', response_minutes: 120, resolution_minutes: 1440, escalation_percent: 80 },
  { priority: 'Basse', response_minutes: 480, resolution_minutes: 4320, escalation_percent: 80 },
]

export const PAUSE_STATUS = 'En attente client'

// ==================== HELPERS ====================

// Calcule la deadline à partir d'une date de départ et d'un nombre de minutes
export function computeDeadline(startDate, minutes) {
  return new Date(new Date(startDate).getTime() + minutes * 60 * 1000)
}

// Formate une date pour SQLite : "YYYY-MM-DD HH:MM:SS"
export function toSqliteDate(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Récupère la politique SLA pour une priorité donnée
export function getSlaPolicy(db, priority) {
  return db.prepare('SELECT * FROM sla_policies WHERE priority = ? AND active = 1').get(priority)
}

// Calcule l'état SLA d'un ticket (respecté, menacé, dépassé)
export function computeSlaStatus(ticket) {
  if (!ticket.sla_resolution_deadline) return null

  // Si déjà résolu, on vérifie s'il a été résolu dans les temps
  if (ticket.status === 'Résolu' && ticket.resolved_at) {
    const resolvedTime = new Date(ticket.resolved_at).getTime()
    const deadlineTime = new Date(ticket.sla_resolution_deadline).getTime()
    return resolvedTime <= deadlineTime ? 'respecté' : 'dépassé'
  }

  // Si en pause, on ne calcule pas
  if (ticket.sla_paused_at) return 'en pause'

  const now = Date.now()
  const deadline = new Date(ticket.sla_resolution_deadline).getTime()
  const created = new Date(ticket.created_at).getTime()
  const total = deadline - created
  const elapsed = now - created
  const percent = (elapsed / total) * 100

  if (now > deadline) return 'dépassé'
  if (percent >= 80) return 'menacé'
  return 'ok'
}

// ==================== INITIALISATION DES TABLES ====================

export function initSlaTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority TEXT UNIQUE NOT NULL,
      response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL,
      escalation_percent INTEGER NOT NULL DEFAULT 80,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    )
  `)

  // Ajouter les colonnes SLA à la table tickets
  const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name)

  if (!ticketColumns.includes('sla_response_deadline')) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_response_deadline TEXT')
    console.log('🔧 Migration SLA : colonne sla_response_deadline ajoutée')
  }

  if (!ticketColumns.includes('sla_resolution_deadline')) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_resolution_deadline TEXT')
    console.log('🔧 Migration SLA : colonne sla_resolution_deadline ajoutée')
  }

  if (!ticketColumns.includes('sla_paused_at')) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_paused_at TEXT')
    console.log('🔧 Migration SLA : colonne sla_paused_at ajoutée')
  }

  if (!ticketColumns.includes('sla_paused_total_minutes')) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_paused_total_minutes INTEGER NOT NULL DEFAULT 0')
    console.log('🔧 Migration SLA : colonne sla_paused_total_minutes ajoutée')
  }

  if (!ticketColumns.includes('resolved_at')) {
    db.exec('ALTER TABLE tickets ADD COLUMN resolved_at TEXT')
    console.log('🔧 Migration SLA : colonne resolved_at ajoutée')
  }

  if (!ticketColumns.includes('sla_escalated')) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_escalated INTEGER NOT NULL DEFAULT 0')
    console.log('🔧 Migration SLA : colonne sla_escalated ajoutée')
  }

  // Seed : créer les 4 politiques par défaut
  const policiesCount = db.prepare('SELECT COUNT(*) as c FROM sla_policies').get().c
  if (policiesCount === 0) {
    const insert = db.prepare(`
      INSERT INTO sla_policies (priority, response_minutes, resolution_minutes, escalation_percent)
      VALUES (?, ?, ?, ?)
    `)
    for (const p of SLA_DEFAULTS) {
      insert.run(p.priority, p.response_minutes, p.resolution_minutes, p.escalation_percent)
    }
    console.log('✅ Politiques SLA par défaut créées')
  }
}

// ==================== APPLICATION DU SLA À UN TICKET ====================

export function applySlaToTicket(db, ticketId, priority, createdAt) {
  const policy = getSlaPolicy(db, priority)
  if (!policy) return null

  const baseDate = createdAt || new Date()
  const responseDeadline = computeDeadline(baseDate, policy.response_minutes)
  const resolutionDeadline = computeDeadline(baseDate, policy.resolution_minutes)

  db.prepare(`
    UPDATE tickets
    SET sla_response_deadline = ?,
        sla_resolution_deadline = ?
    WHERE id = ?
  `).run(
    toSqliteDate(responseDeadline),
    toSqliteDate(resolutionDeadline),
    ticketId
  )

  return { responseDeadline, resolutionDeadline }
}

// ==================== GESTION PAUSE/RESUME ====================

export function pauseSla(db, ticketId) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)
  if (!ticket || ticket.sla_paused_at) return

  db.prepare('UPDATE tickets SET sla_paused_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(ticketId)
}

export function resumeSla(db, ticketId) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)
  if (!ticket || !ticket.sla_paused_at) return

  // Calculer la durée de la pause en minutes
  const pausedAt = new Date(ticket.sla_paused_at).getTime()
  const now = Date.now()
  const pausedMinutes = Math.floor((now - pausedAt) / 60000)

  // Décaler les deadlines
  const newResponseDeadline = ticket.sla_response_deadline
    ? toSqliteDate(new Date(new Date(ticket.sla_response_deadline).getTime() + pausedMinutes * 60000))
    : null
  const newResolutionDeadline = ticket.sla_resolution_deadline
    ? toSqliteDate(new Date(new Date(ticket.sla_resolution_deadline).getTime() + pausedMinutes * 60000))
    : null

  db.prepare(`
    UPDATE tickets
    SET sla_paused_at = NULL,
        sla_paused_total_minutes = sla_paused_total_minutes + ?,
        sla_response_deadline = ?,
        sla_resolution_deadline = ?
    WHERE id = ?
  `).run(pausedMinutes, newResponseDeadline, newResolutionDeadline, ticketId)
}

// ==================== ROUTES API ====================

export function createSlaRouter(db, logAction) {
  const router = Router()

  router.use(authRequired)

  // ---- GET /api/sla/policies ----
  // Accessible à tous les connectés (lecture)
  router.get('/policies', (req, res) => {
    const policies = db.prepare('SELECT * FROM sla_policies ORDER BY resolution_minutes ASC').all()
    res.json(policies)
  })

  // ---- PUT /api/sla/policies/:id ----
  // Modifier une politique (admin uniquement)
  router.put('/policies/:id', adminOnly, (req, res) => {
    const { response_minutes, resolution_minutes, escalation_percent } = req.body
    const targetId = parseInt(req.params.id)

    const policy = db.prepare('SELECT * FROM sla_policies WHERE id = ?').get(targetId)
    if (!policy) return res.status(404).json({ error: 'Politique non trouvée' })

    if (response_minutes !== undefined && (isNaN(response_minutes) || response_minutes < 1)) {
      return res.status(400).json({ error: 'Le temps de réponse doit être > 0' })
    }
    if (resolution_minutes !== undefined && (isNaN(resolution_minutes) || resolution_minutes < 1)) {
      return res.status(400).json({ error: 'Le temps de résolution doit être > 0' })
    }
    if (escalation_percent !== undefined && (isNaN(escalation_percent) || escalation_percent < 1 || escalation_percent > 100)) {
      return res.status(400).json({ error: 'Le seuil d\'escalade doit être entre 1 et 100' })
    }

    db.prepare(`
      UPDATE sla_policies
      SET response_minutes = COALESCE(?, response_minutes),
          resolution_minutes = COALESCE(?, resolution_minutes),
          escalation_percent = COALESCE(?, escalation_percent),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(response_minutes || null, resolution_minutes || null, escalation_percent || null, targetId)

    const updated = db.prepare('SELECT * FROM sla_policies WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'sla', targetId,
      `Politique SLA modifiée : ${policy.priority}`)

    res.json(updated)
  })

  // ---- GET /api/sla/stats ----
  // Statistiques SLA globales
  router.get('/stats', (req, res) => {
    const allTickets = db.prepare(`
      SELECT * FROM tickets WHERE archived = 0
    `).all()

    let respected = 0
    let threatened = 0
    let exceeded = 0
    let paused = 0
    let noSla = 0

    const resolutionTimes = []

    for (const ticket of allTickets) {
      const status = computeSlaStatus(ticket)
      if (status === 'respecté') {
        respected++
        if (ticket.resolved_at && ticket.created_at) {
          const diff = new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
          resolutionTimes.push(diff)
        }
      } else if (status === 'menacé') threatened++
      else if (status === 'dépassé') exceeded++
      else if (status === 'en pause') paused++
      else noSla++
    }

    const total = respected + threatened + exceeded + paused + noSla
    const mttr = resolutionTimes.length > 0
      ? Math.floor(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 60000)
      : 0

    res.json({
      total,
      respected,
      threatened,
      exceeded,
      paused,
      noSla,
      mttr_minutes: mttr,
      respect_rate: total > 0 ? Math.round((respected / (respected + threatened + exceeded)) * 100) : 100,
    })
  })

  // ---- GET /api/sla/export ----
  // Export CSV des stats SLA
  router.get('/export', adminOnly, (req, res) => {
    const tickets = db.prepare(`
      SELECT
        t.id, t.title, t.priority, t.status,
        t.created_at, t.sla_resolution_deadline, t.resolved_at,
        t.sla_paused_total_minutes,
        u.name as assignee_name
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      WHERE t.archived = 0
      ORDER BY t.id DESC
    `).all()

    const headers = ['ID', 'Titre', 'Priorité', 'Statut', 'Créé le', 'Deadline SLA', 'Résolu le', 'Temps pause (min)', 'Assigné à', 'État SLA']
    const rows = tickets.map(t => {
      const state = computeSlaStatus(t) || 'n/a'
      return [
        t.id,
        t.title,
        t.priority,
        t.status,
        t.created_at,
        t.sla_resolution_deadline || '',
        t.resolved_at || '',
        t.sla_paused_total_minutes || 0,
        t.assignee_name || '',
        state,
      ]
    })

    const csvEscape = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }

    const csv = [headers.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n')

    const dateStr = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="sla-report-${dateStr}.csv"`)
    res.send('\uFEFF' + csv)
  })

  return router
}