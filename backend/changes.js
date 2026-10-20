import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { userHasPermission } from './knowledge.js'
import {
  notifyChangeApprovalRequired,
  notifyChangeDecision,
  notifyChangeImplemented,
} from './notifications.js'

// ==================== INITIALISATION ====================

export function initChangeTables(db) {
  // Table des changements (RFC)
  db.exec(`
    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      change_type TEXT NOT NULL DEFAULT 'normal' CHECK(change_type IN ('standard', 'normal', 'emergency')),
      category TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
        'draft', 'analyzing', 'pending_approval', 'scheduled',
        'in_progress', 'implemented', 'rolled_back', 'closed'
      )),
      priority TEXT NOT NULL DEFAULT 'Moyenne',
      risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      impact_analysis TEXT,
      affected_cis TEXT,
      requested_by INTEGER,
      assigned_to INTEGER,
      approved_by INTEGER,
      approved_at TEXT,
      rejection_reason TEXT,
      scheduled_start TEXT,
      scheduled_end TEXT,
      implementation_plan TEXT,
      rollback_plan TEXT,
      implemented_at TEXT,
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  // Table de liaison changements ↔ tickets
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by INTEGER,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(change_id, ticket_id),
      FOREIGN KEY (change_id) REFERENCES changes(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `)

  // Ajouter la permission changes.create si elle n'existe pas
  const perm = db.prepare('SELECT code FROM permissions WHERE code = ?').get('changes.create')
  if (!perm) {
    db.prepare(`
      INSERT INTO permissions (code, label, module, description)
      VALUES (?, ?, ?, ?)
    `).run(
      'changes.create',
      'Créer des changements',
      'changes',
      'Peut créer des RFC (Request For Change)'
    )
    console.log('✅ Permission changes.create créée')

    // Accorder automatiquement aux techniciens
    const techniciens = db.prepare("SELECT id FROM users WHERE role = 'technicien' AND active = 1").all()
    const grantStmt = db.prepare(`
      INSERT OR IGNORE INTO user_permissions (user_id, permission_code, granted_by_name)
      VALUES (?, 'changes.create', 'Système')
    `)
    for (const t of techniciens) {
      grantStmt.run(t.id)
    }
    if (techniciens.length > 0) {
      console.log(`✅ Permission changes.create accordée à ${techniciens.length} technicien(s)`)
    }
  }

  console.log('✅ Tables Changements initialisées')
}

// ==================== HELPERS ====================

const STATUS_LABELS = {
  draft: 'Brouillon',
  analyzing: 'En analyse',
  pending_approval: 'En attente d\'approbation',
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  implemented: 'Réalisée',
  rolled_back: 'Rollback',
  closed: 'Clôturée',
}

const TYPE_LABELS = {
  standard: 'Standard',
  normal: 'Normal',
  emergency: 'Urgence',
}

const RISK_LABELS = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
}

// ==================== ROUTES ====================

export function createChangeRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // Vérifier la permission changes.create
  const canCreateChanges = (req) => {
    return userHasPermission(db, req.user.id, req.user.role, 'changes.create')
  }

  // ---- GET /api/changes ----
  // Liste des changements
  router.get('/', (req, res) => {
    const { status, type, priority } = req.query

    let query = `
      SELECT
        c.*,
        u_req.name as requested_by_name,
        u_ass.name as assigned_to_name,
        u_app.name as approved_by_name,
        (SELECT COUNT(*) FROM change_tickets WHERE change_id = c.id) as tickets_count
      FROM changes c
      LEFT JOIN users u_req ON c.requested_by = u_req.id
      LEFT JOIN users u_ass ON c.assigned_to = u_ass.id
      LEFT JOIN users u_app ON c.approved_by = u_app.id
      WHERE 1=1
    `
    const params = []

    // Filtrage par rôle (non-admin voit seulement ses changements)
    if (req.user.role !== 'admin') {
      query += ' AND (c.requested_by = ? OR c.assigned_to = ?)'
      params.push(req.user.id, req.user.id)
    }

    if (status) {
      query += ' AND c.status = ?'
      params.push(status)
    }
    if (type) {
      query += ' AND c.change_type = ?'
      params.push(type)
    }
    if (priority) {
      query += ' AND c.priority = ?'
      params.push(priority)
    }

    query += ` ORDER BY
      CASE c.status
        WHEN 'pending_approval' THEN 1
        WHEN 'analyzing' THEN 2
        WHEN 'scheduled' THEN 3
        WHEN 'in_progress' THEN 4
        WHEN 'draft' THEN 5
        WHEN 'implemented' THEN 6
        WHEN 'closed' THEN 7
        WHEN 'rolled_back' THEN 8
      END,
      c.priority DESC,
      c.id DESC
    `

    const changes = db.prepare(query).all(...params)
    res.json(changes)
  })

  // ---- GET /api/changes/:id ----
  // Détail d'un changement
  router.get('/:id', (req, res) => {
    const change = db.prepare(`
      SELECT
        c.*,
        u_req.name as requested_by_name,
        u_req.email as requested_by_email,
        u_ass.name as assigned_to_name,
        u_app.name as approved_by_name
      FROM changes c
      LEFT JOIN users u_req ON c.requested_by = u_req.id
      LEFT JOIN users u_ass ON c.assigned_to = u_ass.id
      LEFT JOIN users u_app ON c.approved_by = u_app.id
      WHERE c.id = ?
    `).get(req.params.id)

    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    // Vérifier l'accès
    if (req.user.role !== 'admin' && change.requested_by !== req.user.id && change.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    // Parser les CIs impactés
    if (change.affected_cis) {
      try {
        change.affected_cis = JSON.parse(change.affected_cis)
      } catch {
        change.affected_cis = []
      }
    } else {
      change.affected_cis = []
    }

    if (change.impact_analysis) {
      try {
        change.impact_analysis = JSON.parse(change.impact_analysis)
      } catch {
        change.impact_analysis = null
      }
    }

    // Charger les tickets liés
    const tickets = db.prepare(`
      SELECT
        t.id, t.title, t.status, t.priority,
        ct.linked_at
      FROM change_tickets ct
      JOIN tickets t ON ct.ticket_id = t.id
      WHERE ct.change_id = ?
    `).all(req.params.id)

    res.json({ ...change, tickets })
  })

  // ---- POST /api/changes ----
  // Créer un changement
  router.post('/', (req, res) => {
    if (!canCreateChanges(req)) {
      return res.status(403).json({ error: 'Permission changes.create requise' })
    }

    const {
      title, description, change_type, category, priority, risk_level,
      scheduled_start, scheduled_end, implementation_plan, rollback_plan,
      affected_cis,
    } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre est obligatoire' })
    }

    if (!['standard', 'normal', 'emergency'].includes(change_type)) {
      return res.status(400).json({ error: 'Type de changement invalide' })
    }

    // Statut initial : standard = scheduled (pré-approuvé), sinon draft
    let initialStatus = 'draft'
    if (change_type === 'standard') {
      initialStatus = 'scheduled'
    }

    const affectedCisJson = Array.isArray(affected_cis) ? JSON.stringify(affected_cis) : null

    const result = db.prepare(`
      INSERT INTO changes (
        title, description, change_type, category, priority, risk_level,
        affected_cis, requested_by, status,
        scheduled_start, scheduled_end, implementation_plan, rollback_plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description?.trim() || null,
      change_type,
      category?.trim() || null,
      priority || 'Moyenne',
      risk_level || 'medium',
      affectedCisJson,
      req.user.id,
      initialStatus,
      scheduled_start || null,
      scheduled_end || null,
      implementation_plan?.trim() || null,
      rollback_plan?.trim() || null
    )

    const changeId = result.lastInsertRowid

    logAction(req.user.id, req.user.name, 'create', 'change', changeId,
      `RFC créée : ${title} (${change_type})`)

    const newChange = db.prepare('SELECT * FROM changes WHERE id = ?').get(changeId)
    res.status(201).json(newChange)
  })

  // ---- PATCH /api/changes/:id ----
  // Modifier un changement
  router.patch('/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    // Seuls le créateur, l'assigné ou un admin peuvent modifier
    if (req.user.role !== 'admin' && change.requested_by !== req.user.id && change.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const allowed = [
      'title', 'description', 'category', 'priority', 'risk_level',
      'status', 'scheduled_start', 'scheduled_end',
      'implementation_plan', 'rollback_plan', 'affected_cis', 'assigned_to',
    ]

    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'affected_cis') {
          values.push(Array.isArray(req.body[field]) ? JSON.stringify(req.body[field]) : req.body[field])
        } else {
          values.push(req.body[field])
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    }

    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    values.push(targetId)

    db.prepare(`UPDATE changes SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'change', targetId,
      `RFC modifiée : ${updated.title}${req.body.status ? ` → ${req.body.status}` : ''}`)

    res.json(updated)
  })

  // ---- POST /api/changes/:id/submit ----
  // Soumettre pour approbation
  router.post('/:id/submit', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (change.status !== 'draft' && change.status !== 'analyzing') {
      return res.status(400).json({ error: 'Ce changement ne peut pas être soumis' })
    }

    // Standard → auto-approuvé
    const newStatus = change.change_type === 'standard' ? 'scheduled' : 'pending_approval'

    db.prepare(`
      UPDATE changes
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newStatus, targetId)

    logAction(req.user.id, req.user.name, 'submit', 'change', targetId,
  `RFC soumise : ${newStatus === 'scheduled' ? 'auto-approuvée (Standard)' : 'en attente d\'approbation'}`)

// Notification
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
const updatedChange = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)

if (newStatus === 'pending_approval') {
  try {
    await notifyChangeApprovalRequired(db, updatedChange, frontendUrl)
  } catch (err) {
    console.error('Erreur notification approbation:', err)
  }
}

res.json({ success: true, status: newStatus })
  })

  // ---- POST /api/changes/:id/approve ----
  // Approuver (admin)
  router.post('/:id/approve', adminOnly, async (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (change.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ce changement n\'est pas en attente d\'approbation' })
    }

    db.prepare(`
      UPDATE changes
      SET status = 'scheduled',
          approved_by = ?,
          approved_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.user.id, targetId)

    logAction(req.user.id, req.user.name, 'approve', 'change', targetId,
  `RFC approuvée : ${change.title}`)

// Notification
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
const updatedChange = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)

try {
  await notifyChangeDecision(db, updatedChange, 'approved', null, frontendUrl)
} catch (err) {
  console.error('Erreur notification décision:', err)
}

res.json({ success: true })
  })

  // ---- POST /api/changes/:id/reject ----
  // Refuser (admin)
  router.post('/:id/reject', adminOnly, async (req, res) => {
    const { reason } = req.body
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Motif de refus obligatoire' })
    }

    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    db.prepare(`
      UPDATE changes
      SET status = 'draft',
          rejection_reason = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(reason.trim(), targetId)

    logAction(req.user.id, req.user.name, 'reject', 'change', targetId,
  `RFC refusée : ${reason}`)

// Notification
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
const updatedChange = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)

try {
  await notifyChangeDecision(db, updatedChange, 'rejected', reason, frontendUrl)
} catch (err) {
  console.error('Erreur notification refus:', err)
}

res.json({ success: true })
  })

  // ---- POST /api/changes/:id/start ----
  // Démarrer l'implémentation
  router.post('/:id/start', (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (change.status !== 'scheduled') {
      return res.status(400).json({ error: 'Le changement doit être planifié' })
    }

    db.prepare(`
      UPDATE changes
      SET status = 'in_progress', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'start', 'change', targetId,
      `RFC en cours : ${change.title}`)

    res.json({ success: true })
  })

  // ---- POST /api/changes/:id/complete ----
  // Marquer comme réalisée
  router.post('/:id/complete', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (change.status !== 'in_progress') {
      return res.status(400).json({ error: 'Le changement doit être en cours' })
    }

    db.prepare(`
      UPDATE changes
      SET status = 'implemented',
          implemented_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'complete', 'change', targetId,
  `RFC réalisée : ${change.title}`)

// Notification
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
const updatedChange = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)

try {
  await notifyChangeImplemented(db, updatedChange, frontendUrl)
} catch (err) {
  console.error('Erreur notification réalisation:', err)
}

res.json({ success: true })
  })

  // ---- POST /api/changes/:id/rollback ----
  // Rollback
  router.post('/:id/rollback', (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (!['in_progress', 'implemented'].includes(change.status)) {
      return res.status(400).json({ error: 'Le changement doit être en cours ou réalisé' })
    }

    db.prepare(`
      UPDATE changes
      SET status = 'rolled_back', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'rollback', 'change', targetId,
      `RFC rollback : ${change.title}`)

    res.json({ success: true })
  })

  // ---- POST /api/changes/:id/close ----
  // Clôturer
  router.post('/:id/close', (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    if (!['implemented', 'rolled_back'].includes(change.status)) {
      return res.status(400).json({ error: 'Le changement doit être réalisé ou rollback' })
    }

    db.prepare(`
      UPDATE changes
      SET status = 'closed',
          closed_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'close', 'change', targetId,
      `RFC clôturée : ${change.title}`)

    res.json({ success: true })
  })

  // ---- POST /api/changes/:id/link-ticket ----
  router.post('/:id/link-ticket', (req, res) => {
    const changeId = parseInt(req.params.id)
    const { ticket_id } = req.body

    if (!ticket_id) return res.status(400).json({ error: 'ticket_id obligatoire' })

    try {
      db.prepare(`
        INSERT INTO change_tickets (change_id, ticket_id, linked_by)
        VALUES (?, ?, ?)
      `).run(changeId, ticket_id, req.user.id)

      res.status(201).json({ success: true })
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Déjà lié' })
      }
      res.status(500).json({ error: err.message })
    }
  })

  // ---- DELETE /api/changes/:id/unlink-ticket/:ticketId ----
  router.delete('/:id/unlink-ticket/:ticketId', (req, res) => {
    db.prepare('DELETE FROM change_tickets WHERE change_id = ? AND ticket_id = ?')
      .run(req.params.id, req.params.ticketId)
    res.json({ success: true })
  })

  // ---- DELETE /api/changes/:id ----
  router.delete('/:id', adminOnly, (req, res) => {
    const targetId = parseInt(req.params.id)
    const change = db.prepare('SELECT * FROM changes WHERE id = ?').get(targetId)
    if (!change) return res.status(404).json({ error: 'Changement non trouvé' })

    db.prepare('DELETE FROM changes WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'change', targetId, `RFC supprimée`)

    res.json({ success: true })
  })

  // ---- POST /api/changes/:id/analyze-impact ----
  // Analyser l'impact des CIs sélectionnés
  router.post('/:id/analyze-impact', (req, res) => {
    const { ci_ids } = req.body

    if (!Array.isArray(ci_ids) || ci_ids.length === 0) {
      return res.status(400).json({ error: 'ci_ids obligatoire (tableau)' })
    }

    // Pour chaque CI, calculer l'impact récursif
    const impacts = []

    function findImpacted(currentId, level, visited) {
      if (level > 3) return

      const dependents = db.prepare(`
        SELECT
          r.parent_id, r.relation_type,
          c.name, c.code, c.type, c.criticality
        FROM ci_relations r
        JOIN configuration_items c ON r.parent_id = c.id
        WHERE r.child_id = ?
      `).all(currentId)

      for (const dep of dependents) {
        if (!visited.has(dep.parent_id)) {
          visited.add(dep.parent_id)
          impacts.push({
            ci_id: dep.parent_id,
            name: dep.name,
            code: dep.code,
            type: dep.type,
            criticality: dep.criticality,
            relation_type: dep.relation_type,
            level,
            source_ci_id: currentId,
          })
          findImpacted(dep.parent_id, level + 1, visited)
        }
      }
    }

    // Pour chaque CI source
    const sourceCis = []
    for (const ciId of ci_ids) {
      const ci = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(ciId)
      if (ci) {
        sourceCis.push(ci)
        const visited = new Set([ciId])
        findImpacted(ciId, 1, visited)
      }
    }

    // Compter les CIs critiques impactés
    const criticalImpacts = impacts.filter(i => i.criticality === 'Critique')

    res.json({
      source_cis: sourceCis,
      impacted_cis: impacts,
      total_impacted: impacts.length,
      critical_impacts: criticalImpacts.length,
      has_critical_impact: criticalImpacts.length > 0,
    })
  })

  return router
}