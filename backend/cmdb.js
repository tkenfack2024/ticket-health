import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'

// ==================== INITIALISATION ====================

export function initCmdbTables(db) {
  // Table des Configuration Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuration_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      type TEXT NOT NULL CHECK(type IN (
        'server', 'vm', 'application', 'database',
        'network_device', 'service', 'endpoint'
      )),
      description TEXT,
      status TEXT NOT NULL DEFAULT 'En service',
      environment TEXT DEFAULT 'Production',
      location TEXT,
      owner TEXT,
      criticality TEXT NOT NULL DEFAULT 'Standard',
      asset_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    )
  `)

  // Table des relations entre CIs
  db.exec(`
    CREATE TABLE IF NOT EXISTS ci_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL CHECK(relation_type IN (
        'depends_on', 'hosts', 'runs_on', 'connects_to', 'part_of'
      )),
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(parent_id, child_id, relation_type),
      FOREIGN KEY (parent_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES configuration_items(id) ON DELETE CASCADE
    )
  `)

  // Table de liaison ticket ↔ CI
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_cis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      ci_id INTEGER NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      linked_by_id INTEGER,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(ticket_id, ci_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables CMDB initialisées')
}

// ==================== HELPERS ====================

const RELATION_LABELS = {
  depends_on: 'Dépend de',
  hosts: 'Héberge',
  runs_on: 'Tourne sur',
  connects_to: 'Connecté à',
  part_of: 'Fait partie de',
}

// ==================== ROUTES ====================

export function createCmdbRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/cmdb/cis ----
  // Liste des CIs avec filtres
  router.get('/cis', (req, res) => {
    const { type, status, search, criticality } = req.query

    let query = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM ci_relations WHERE parent_id = c.id) as dependencies_count,
        (SELECT COUNT(*) FROM ci_relations WHERE child_id = c.id) as dependents_count,
        (SELECT COUNT(*) FROM ticket_cis WHERE ci_id = c.id) as tickets_count
      FROM configuration_items c
      WHERE 1=1
    `
    const params = []

    if (type) {
      query += ' AND c.type = ?'
      params.push(type)
    }
    if (status) {
      query += ' AND c.status = ?'
      params.push(status)
    }
    if (criticality) {
      query += ' AND c.criticality = ?'
      params.push(criticality)
    }
    if (search) {
      query += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.description LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }

    query += ' ORDER BY c.criticality DESC, c.name ASC'

    const cis = db.prepare(query).all(...params)

    // Déchiffrer les notes
    for (const ci of cis) {
      ci.notes = decrypt(ci.notes)
    }

    res.json(cis)
  })

  // ---- GET /api/cmdb/cis/:id ----
  // Détail d'un CI avec ses relations
  router.get('/cis/:id', (req, res) => {
    const ci = db.prepare(`
      SELECT
        c.*,
        a.name as asset_name,
        a.serial_number as asset_serial_number
      FROM configuration_items c
      LEFT JOIN assets a ON c.asset_id = a.id
      WHERE c.id = ?
    `).get(req.params.id)

    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

    ci.notes = decrypt(ci.notes)

    // Relations sortantes (ce CI dépend de...)
    const outgoing = db.prepare(`
      SELECT
        r.id, r.relation_type, r.description,
        c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
      FROM ci_relations r
      JOIN configuration_items c ON r.child_id = c.id
      WHERE r.parent_id = ?
    `).all(req.params.id)

    // Relations entrantes (... dépend de ce CI)
    const incoming = db.prepare(`
      SELECT
        r.id, r.relation_type, r.description,
        c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
      FROM ci_relations r
      JOIN configuration_items c ON r.parent_id = c.id
      WHERE r.child_id = ?
    `).all(req.params.id)

    // Tickets liés
    const tickets = db.prepare(`
      SELECT
        t.id, t.title, t.status, t.priority,
        tc.is_primary, tc.linked_at
      FROM ticket_cis tc
      JOIN tickets t ON tc.ticket_id = t.id
      WHERE tc.ci_id = ?
      ORDER BY tc.linked_at DESC
      LIMIT 20
    `).all(req.params.id)

    // Analyse d'impact : tous les CIs qui dépendent (directement ou indirectement) de ce CI
    const impacted = getImpactAnalysis(db, req.params.id)

    res.json({
      ...ci,
      relations_out: outgoing,
      relations_in: incoming,
      tickets,
      impact_analysis: impacted,
    })
  })

  // ---- POST /api/cmdb/cis ----
  // Créer un CI
  router.post('/cis', (req, res) => {
    const {
      name, code, type, description, status, environment,
      location, owner, criticality, asset_id, notes
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }
    if (!type || !['server', 'vm', 'application', 'database', 'network_device', 'service', 'endpoint'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' })
    }

    try {
      const encryptedNotes = notes ? encrypt(notes) : null

      const result = db.prepare(`
        INSERT INTO configuration_items (
          name, code, type, description, status, environment,
          location, owner, criticality, asset_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        code?.trim() || null,
        type,
        description?.trim() || null,
        status || 'En service',
        environment || 'Production',
        location?.trim() || null,
        owner?.trim() || null,
        criticality || 'Standard',
        asset_id || null,
        encryptedNotes
      )

      const newCi = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(result.lastInsertRowid)
      newCi.notes = decrypt(newCi.notes)

      logAction(req.user.id, req.user.name, 'create', 'ci', newCi.id, `CI créé : ${newCi.name} (${newCi.type})`)

      res.status(201).json(newCi)
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Ce code CI existe déjà' })
      }
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- PATCH /api/cmdb/cis/:id ----
  // Modifier un CI
  router.patch('/cis/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const ci = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

    const allowed = [
      'name', 'code', 'type', 'description', 'status', 'environment',
      'location', 'owner', 'criticality', 'asset_id', 'notes'
    ]

    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'notes' && req.body[field]) {
          values.push(encrypt(req.body[field]))
        } else {
          values.push(req.body[field] || null)
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    }

    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    values.push(targetId)

    db.prepare(`UPDATE configuration_items SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    updated.notes = decrypt(updated.notes)

    logAction(req.user.id, req.user.name, 'update', 'ci', targetId, `CI modifié : ${updated.name}`)

    res.json(updated)
  })

  // ---- DELETE /api/cmdb/cis/:id ----
  // Supprimer un CI
  router.delete('/cis/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const ci = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

    // Vérifier s'il y a des tickets liés
    const ticketCount = db.prepare('SELECT COUNT(*) as c FROM ticket_cis WHERE ci_id = ?').get(targetId).c
    if (ticketCount > 0) {
      return res.status(400).json({
        error: `Ce CI est lié à ${ticketCount} ticket(s). Retirez les liens avant de supprimer.`
      })
    }

    db.prepare('DELETE FROM configuration_items WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'delete', 'ci', targetId, `CI supprimé : ${ci.name}`)

    res.json({ success: true })
  })

  // ==================== RELATIONS ====================

  // ---- POST /api/cmdb/relations ----
  router.post('/relations', (req, res) => {
    const { parent_id, child_id, relation_type, description } = req.body

    if (!parent_id || !child_id || !relation_type) {
      return res.status(400).json({ error: 'parent_id, child_id et relation_type obligatoires' })
    }

    if (parent_id === child_id) {
      return res.status(400).json({ error: 'Un CI ne peut pas être en relation avec lui-même' })
    }

    if (!['depends_on', 'hosts', 'runs_on', 'connects_to', 'part_of'].includes(relation_type)) {
      return res.status(400).json({ error: 'Type de relation invalide' })
    }

    const parent = db.prepare('SELECT id, name FROM configuration_items WHERE id = ?').get(parent_id)
    const child = db.prepare('SELECT id, name FROM configuration_items WHERE id = ?').get(child_id)
    if (!parent) return res.status(404).json({ error: 'CI parent introuvable' })
    if (!child) return res.status(404).json({ error: 'CI enfant introuvable' })

    try {
      const result = db.prepare(`
        INSERT INTO ci_relations (parent_id, child_id, relation_type, description)
        VALUES (?, ?, ?, ?)
      `).run(parent_id, child_id, relation_type, description || null)

      logAction(req.user.id, req.user.name, 'create', 'ci_relation', result.lastInsertRowid,
        `Relation ${relation_type} : ${parent.name} → ${child.name}`)

      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Cette relation existe déjà' })
      }
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- DELETE /api/cmdb/relations/:id ----
  router.delete('/relations/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const relation = db.prepare('SELECT * FROM ci_relations WHERE id = ?').get(targetId)
    if (!relation) return res.status(404).json({ error: 'Relation non trouvée' })

    db.prepare('DELETE FROM ci_relations WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'delete', 'ci_relation', targetId, 'Relation supprimée')

    res.json({ success: true })
  })


  return router
}

// ==================== ANALYSE D'IMPACT ====================

function getImpactAnalysis(db, ciId) {
  // Trouver tous les CIs qui dépendent de ce CI (récursif, max 3 niveaux)
  const visited = new Set([ciId])
  const impacted = []

  function findImpacted(currentId, level) {
    if (level > 3) return // Limite de profondeur

    // CIs qui dépendent de currentId (relations entrantes : X depends_on currentId)
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
        impacted.push({
          ci_id: dep.parent_id,
          name: dep.name,
          code: dep.code,
          type: dep.type,
          criticality: dep.criticality,
          relation_type: dep.relation_type,
          level,
        })
        findImpacted(dep.parent_id, level + 1)
      }
    }
  }

  findImpacted(ciId, 1)

  return impacted
}