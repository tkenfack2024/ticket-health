import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================

export function initCmdbTables(db) {
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
  router.get('/cis', async (req, res) => {
    const { type, status, search, criticality } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT c.*,
            (SELECT COUNT(*) FROM ci_relations WHERE parent_id = c.id) as dependencies_count,
            (SELECT COUNT(*) FROM ci_relations WHERE child_id = c.id) as dependents_count,
            (SELECT COUNT(*) FROM ticket_cis WHERE ci_id = c.id) as tickets_count
          FROM configuration_items c
          WHERE 1=1
        `
        const args = []
        if (type) { query += ' AND c.type = ?'; args.push(type) }
        if (status) { query += ' AND c.status = ?'; args.push(status) }
        if (criticality) { query += ' AND c.criticality = ?'; args.push(criticality) }
        if (search) {
          query += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.description LIKE ?)'
          const s = `%${search}%`
          args.push(s, s, s)
        }
        query += ' ORDER BY c.criticality DESC, c.name ASC'

        const result = await tursoDb.execute({ sql: query, args })
        const cis = result.rows
        for (const ci of cis) ci.notes = decrypt(ci.notes)
        return res.json(cis)
      } catch (err) {
        console.error('Erreur Turso GET CIs:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM ci_relations WHERE parent_id = c.id) as dependencies_count,
        (SELECT COUNT(*) FROM ci_relations WHERE child_id = c.id) as dependents_count,
        (SELECT COUNT(*) FROM ticket_cis WHERE ci_id = c.id) as tickets_count
      FROM configuration_items c
      WHERE 1=1
    `
    const params = []
    if (type) { query += ' AND c.type = ?'; params.push(type) }
    if (status) { query += ' AND c.status = ?'; params.push(status) }
    if (criticality) { query += ' AND c.criticality = ?'; params.push(criticality) }
    if (search) {
      query += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.description LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }
    query += ' ORDER BY c.criticality DESC, c.name ASC'

    const cis = db.prepare(query).all(...params)
    for (const ci of cis) ci.notes = decrypt(ci.notes)
    res.json(cis)
  })

  // ---- GET /api/cmdb/cis/:id ----
  router.get('/cis/:id', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const ciResult = await tursoDb.execute({
          sql: `
            SELECT c.*, a.name as asset_name, a.serial_number as asset_serial_number
            FROM configuration_items c
            LEFT JOIN assets a ON c.asset_id = a.id
            WHERE c.id = ?
          `,
          args: [req.params.id]
        })
        const ci = ciResult.rows[0]
        if (!ci) return res.status(404).json({ error: 'CI non trouvé' })
        ci.notes = decrypt(ci.notes)

        const outgoingResult = await tursoDb.execute({
          sql: `
            SELECT r.id, r.relation_type, r.description, c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
            FROM ci_relations r JOIN configuration_items c ON r.child_id = c.id WHERE r.parent_id = ?
          `,
          args: [req.params.id]
        })

        const incomingResult = await tursoDb.execute({
          sql: `
            SELECT r.id, r.relation_type, r.description, c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
            FROM ci_relations r JOIN configuration_items c ON r.parent_id = c.id WHERE r.child_id = ?
          `,
          args: [req.params.id]
        })

        const ticketsResult = await tursoDb.execute({
          sql: `
            SELECT t.id, t.title, t.status, t.priority, tc.is_primary, tc.linked_at
            FROM ticket_cis tc JOIN tickets t ON tc.ticket_id = t.id WHERE tc.ci_id = ? ORDER BY tc.linked_at DESC LIMIT 20
          `,
          args: [req.params.id]
        })

        const impacted = await getImpactAnalysisTurso(tursoDb, req.params.id)

        return res.json({
          ...ci,
          relations_out: outgoingResult.rows,
          relations_in: incomingResult.rows,
          tickets: ticketsResult.rows,
          impact_analysis: impacted,
        })
      } catch (err) {
        console.error('Erreur Turso GET CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ci = db.prepare(`
      SELECT c.*, a.name as asset_name, a.serial_number as asset_serial_number
      FROM configuration_items c
      LEFT JOIN assets a ON c.asset_id = a.id
      WHERE c.id = ?
    `).get(req.params.id)

    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })
    ci.notes = decrypt(ci.notes)

    const outgoing = db.prepare(`
      SELECT r.id, r.relation_type, r.description, c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
      FROM ci_relations r JOIN configuration_items c ON r.child_id = c.id WHERE r.parent_id = ?
    `).all(req.params.id)

    const incoming = db.prepare(`
      SELECT r.id, r.relation_type, r.description, c.id as ci_id, c.name, c.code, c.type, c.status, c.criticality
      FROM ci_relations r JOIN configuration_items c ON r.parent_id = c.id WHERE r.child_id = ?
    `).all(req.params.id)

    const tickets = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, tc.is_primary, tc.linked_at
      FROM ticket_cis tc JOIN tickets t ON tc.ticket_id = t.id WHERE tc.ci_id = ? ORDER BY tc.linked_at DESC LIMIT 20
    `).all(req.params.id)

    const impacted = getImpactAnalysis(db, req.params.id)

    res.json({ ...ci, relations_out: outgoing, relations_in: incoming, tickets, impact_analysis: impacted })
  })

  // ---- POST /api/cmdb/cis ----
  router.post('/cis', async (req, res) => {
    const { name, code, type, description, status, environment, location, owner, criticality, asset_id, notes } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })
    if (!type || !['server', 'vm', 'application', 'database', 'network_device', 'service', 'endpoint'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' })
    }

    const encryptedNotes = notes ? encrypt(notes) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO configuration_items (name, code, type, description, status, environment, location, owner, criticality, asset_id, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [name.trim(), code?.trim() || null, type, description?.trim() || null, status || 'En service',
                 environment || 'Production', location?.trim() || null, owner?.trim() || null,
                 criticality || 'Standard', asset_id || null, encryptedNotes]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'ci', newId, `CI créé : ${name} (${type})`)

        const newCiResult = await tursoDb.execute({ sql: 'SELECT * FROM configuration_items WHERE id = ?', args: [newId] })
        const newCi = newCiResult.rows[0]
        newCi.notes = decrypt(newCi.notes)
        return res.status(201).json(newCi)
      } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce code CI existe déjà' })
        console.error('Erreur Turso POST CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    try {
      const result = db.prepare(`
        INSERT INTO configuration_items (name, code, type, description, status, environment, location, owner, criticality, asset_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name.trim(), code?.trim() || null, type, description?.trim() || null, status || 'En service',
             environment || 'Production', location?.trim() || null, owner?.trim() || null,
             criticality || 'Standard', asset_id || null, encryptedNotes)

      const newCi = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(result.lastInsertRowid)
      newCi.notes = decrypt(newCi.notes)
      logAction(req.user.id, req.user.name, 'create', 'ci', newCi.id, `CI créé : ${newCi.name} (${newCi.type})`)
      res.status(201).json(newCi)
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce code CI existe déjà' })
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- PATCH /api/cmdb/cis/:id ----
  router.patch('/cis/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM configuration_items WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'CI non trouvé' })

        const allowed = ['name', 'code', 'type', 'description', 'status', 'environment', 'location', 'owner', 'criticality', 'asset_id', 'notes']
        const updates = []
        const args = []

        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'notes' && req.body[field]) args.push(encrypt(req.body[field]))
            else args.push(req.body[field] || null)
          }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        updates.push('updated_at = datetime(\'now\', \'localtime\')')
        args.push(targetId)

        await tursoDb.execute({ sql: `UPDATE configuration_items SET ${updates.join(', ')} WHERE id = ?`, args })

        logAction(req.user.id, req.user.name, 'update', 'ci', targetId, `CI modifié`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM configuration_items WHERE id = ?', args: [targetId] })
        const ci = updated.rows[0]
        ci.notes = decrypt(ci.notes)
        return res.json(ci)
      } catch (err) {
        console.error('Erreur Turso PATCH CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ci = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

    const allowed = ['name', 'code', 'type', 'description', 'status', 'environment', 'location', 'owner', 'criticality', 'asset_id', 'notes']
    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'notes' && req.body[field]) values.push(encrypt(req.body[field]))
        else values.push(req.body[field] || null)
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    values.push(targetId)

    db.prepare(`UPDATE configuration_items SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const updated = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    updated.notes = decrypt(updated.notes)
    logAction(req.user.id, req.user.name, 'update', 'ci', targetId, `CI modifié : ${updated.name}`)
    res.json(updated)
  })

  // ---- DELETE /api/cmdb/cis/:id ----
  router.delete('/cis/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM configuration_items WHERE id = ?', args: [targetId] })
        const ci = check.rows[0]
        if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

        const ticketCountResult = await tursoDb.execute({ sql: 'SELECT COUNT(*) as c FROM ticket_cis WHERE ci_id = ?', args: [targetId] })
        const ticketCount = ticketCountResult.rows[0].c
        if (ticketCount > 0) return res.status(400).json({ error: `Ce CI est lié à ${ticketCount} ticket(s). Retirez les liens avant de supprimer.` })

        await tursoDb.execute({ sql: 'DELETE FROM configuration_items WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'ci', targetId, `CI supprimé : ${ci.name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ci = db.prepare('SELECT * FROM configuration_items WHERE id = ?').get(targetId)
    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })

    const ticketCount = db.prepare('SELECT COUNT(*) as c FROM ticket_cis WHERE ci_id = ?').get(targetId).c
    if (ticketCount > 0) return res.status(400).json({ error: `Ce CI est lié à ${ticketCount} ticket(s). Retirez les liens avant de supprimer.` })

    db.prepare('DELETE FROM configuration_items WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'ci', targetId, `CI supprimé : ${ci.name}`)
    res.json({ success: true })
  })

  // ==================== RELATIONS ====================
  router.post('/relations', async (req, res) => {
    const { parent_id, child_id, relation_type, description } = req.body
    const { tenantId } = req.user

    if (!parent_id || !child_id || !relation_type) return res.status(400).json({ error: 'parent_id, child_id et relation_type obligatoires' })
    if (parent_id === child_id) return res.status(400).json({ error: 'Un CI ne peut pas être en relation avec lui-même' })
    if (!['depends_on', 'hosts', 'runs_on', 'connects_to', 'part_of'].includes(relation_type)) return res.status(400).json({ error: 'Type de relation invalide' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const p = await tursoDb.execute({ sql: 'SELECT id, name FROM configuration_items WHERE id = ?', args: [parent_id] })
        const c = await tursoDb.execute({ sql: 'SELECT id, name FROM configuration_items WHERE id = ?', args: [child_id] })
        if (p.rows.length === 0) return res.status(404).json({ error: 'CI parent introuvable' })
        if (c.rows.length === 0) return res.status(404).json({ error: 'CI enfant introuvable' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO ci_relations (parent_id, child_id, relation_type, description) VALUES (?, ?, ?, ?)`,
          args: [parent_id, child_id, relation_type, description || null]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'ci_relation', newId, `Relation ${relation_type} : ${p.rows[0].name} → ${c.rows[0].name}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cette relation existe déjà' })
        console.error('Erreur Turso POST relation:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const parent = db.prepare('SELECT id, name FROM configuration_items WHERE id = ?').get(parent_id)
    const child = db.prepare('SELECT id, name FROM configuration_items WHERE id = ?').get(child_id)
    if (!parent) return res.status(404).json({ error: 'CI parent introuvable' })
    if (!child) return res.status(404).json({ error: 'CI enfant introuvable' })

    try {
      const result = db.prepare(`INSERT INTO ci_relations (parent_id, child_id, relation_type, description) VALUES (?, ?, ?, ?)`)
        .run(parent_id, child_id, relation_type, description || null)
      logAction(req.user.id, req.user.name, 'create', 'ci_relation', result.lastInsertRowid, `Relation ${relation_type} : ${parent.name} → ${child.name}`)
      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cette relation existe déjà' })
      return res.status(500).json({ error: err.message })
    }
  })

  router.delete('/relations/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM ci_relations WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Relation non trouvée' })

        await tursoDb.execute({ sql: 'DELETE FROM ci_relations WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'ci_relation', targetId, 'Relation supprimée')
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE relation:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const relation = db.prepare('SELECT * FROM ci_relations WHERE id = ?').get(targetId)
    if (!relation) return res.status(404).json({ error: 'Relation non trouvée' })
    db.prepare('DELETE FROM ci_relations WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'ci_relation', targetId, 'Relation supprimée')
    res.json({ success: true })
  })

  // ==================== LIAISON TICKET ↔ CI ====================
  router.get('/tickets/:ticketId/cis', async (req, res) => {
    const ticketId = parseInt(req.params.ticketId)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `
            SELECT c.id, c.name, c.code, c.type, c.criticality, c.status, tc.is_primary, tc.linked_at
            FROM ticket_cis tc JOIN configuration_items c ON tc.ci_id = c.id
            WHERE tc.ticket_id = ? ORDER BY tc.is_primary DESC, tc.linked_at DESC
          `,
          args: [ticketId]
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET ticket CIs:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const cis = db.prepare(`
      SELECT c.id, c.name, c.code, c.type, c.criticality, c.status, tc.is_primary, tc.linked_at
      FROM ticket_cis tc JOIN configuration_items c ON tc.ci_id = c.id
      WHERE tc.ticket_id = ? ORDER BY tc.is_primary DESC, tc.linked_at DESC
    `).all(ticketId)
    res.json(cis)
  })

  router.post('/tickets/:ticketId/cis', async (req, res) => {
    const ticketId = parseInt(req.params.ticketId)
    const { ci_id, is_primary } = req.body
    const { tenantId } = req.user
    if (!ci_id) return res.status(400).json({ error: 'ci_id obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const t = await tursoDb.execute({ sql: 'SELECT id, title FROM tickets WHERE id = ?', args: [ticketId] })
        if (t.rows.length === 0) return res.status(404).json({ error: 'Ticket non trouvé' })
        const c = await tursoDb.execute({ sql: 'SELECT id, name FROM configuration_items WHERE id = ?', args: [ci_id] })
        if (c.rows.length === 0) return res.status(404).json({ error: 'CI non trouvé' })
        const existing = await tursoDb.execute({ sql: 'SELECT id FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?', args: [ticketId, ci_id] })
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Ce CI est déjà lié à ce ticket' })

        if (is_primary) await tursoDb.execute({ sql: 'UPDATE ticket_cis SET is_primary = 0 WHERE ticket_id = ?', args: [ticketId] })

        const result = await tursoDb.execute({
          sql: `INSERT INTO ticket_cis (ticket_id, ci_id, is_primary, linked_by_id) VALUES (?, ?, ?, ?)`,
          args: [ticketId, ci_id, is_primary ? 1 : 0, req.user.id]
        })

        logAction(req.user.id, req.user.name, 'link', 'ticket', ticketId, `CI "${c.rows[0].name}" lié au ticket`)
        return res.status(201).json({ success: true, id: Number(result.lastInsertRowid) })
      } catch (err) {
        console.error('Erreur Turso POST ticket CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })
    const ci = db.prepare('SELECT id, name FROM configuration_items WHERE id = ?').get(ci_id)
    if (!ci) return res.status(404).json({ error: 'CI non trouvé' })
    const existing = db.prepare('SELECT id FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?').get(ticketId, ci_id)
    if (existing) return res.status(409).json({ error: 'Ce CI est déjà lié à ce ticket' })

    if (is_primary) db.prepare('UPDATE ticket_cis SET is_primary = 0 WHERE ticket_id = ?').run(ticketId)

    const result = db.prepare(`INSERT INTO ticket_cis (ticket_id, ci_id, is_primary, linked_by_id) VALUES (?, ?, ?, ?)`)
      .run(ticketId, ci_id, is_primary ? 1 : 0, req.user.id)

    logAction(req.user.id, req.user.name, 'link', 'ticket', ticketId, `CI "${ci.name}" lié au ticket`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  router.delete('/tickets/:ticketId/cis/:ciId', async (req, res) => {
    const ticketId = parseInt(req.params.ticketId)
    const ciId = parseInt(req.params.ciId)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({ sql: 'DELETE FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?', args: [ticketId, ciId] })
        if (result.rowsAffected === 0) return res.status(404).json({ error: 'Lien non trouvé' })
        logAction(req.user.id, req.user.name, 'unlink', 'ticket', ticketId, `CI #${ciId} délié`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE ticket CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const result = db.prepare('DELETE FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?').run(ticketId, ciId)
    if (result.changes === 0) return res.status(404).json({ error: 'Lien non trouvé' })
    logAction(req.user.id, req.user.name, 'unlink', 'ticket', ticketId, `CI #${ciId} délié`)
    res.json({ success: true })
  })

  router.post('/tickets/:ticketId/cis/:ciId/primary', async (req, res) => {
    const ticketId = parseInt(req.params.ticketId)
    const ciId = parseInt(req.params.ciId)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const existing = await tursoDb.execute({ sql: 'SELECT id FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?', args: [ticketId, ciId] })
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Lien non trouvé' })

        await tursoDb.execute({ sql: 'UPDATE ticket_cis SET is_primary = 0 WHERE ticket_id = ?', args: [ticketId] })
        await tursoDb.execute({ sql: 'UPDATE ticket_cis SET is_primary = 1 WHERE ticket_id = ? AND ci_id = ?', args: [ticketId, ciId] })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso primary CI:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const existing = db.prepare('SELECT id FROM ticket_cis WHERE ticket_id = ? AND ci_id = ?').get(ticketId, ciId)
    if (!existing) return res.status(404).json({ error: 'Lien non trouvé' })

    db.prepare('UPDATE ticket_cis SET is_primary = 0 WHERE ticket_id = ?').run(ticketId)
    db.prepare('UPDATE ticket_cis SET is_primary = 1 WHERE ticket_id = ? AND ci_id = ?').run(ticketId, ciId)
    res.json({ success: true })
  })

  return router
}

// ==================== ANALYSE D'IMPACT ====================

function getImpactAnalysis(db, ciId) {
  const visited = new Set([ciId])
  const impacted = []

  function findImpacted(currentId, level) {
    if (level > 3) return
    const dependents = db.prepare(`
      SELECT r.parent_id, r.relation_type, c.name, c.code, c.type, c.criticality
      FROM ci_relations r JOIN configuration_items c ON r.parent_id = c.id WHERE r.child_id = ?
    `).all(currentId)

    for (const dep of dependents) {
      if (!visited.has(dep.parent_id)) {
        visited.add(dep.parent_id)
        impacted.push({ ci_id: dep.parent_id, name: dep.name, code: dep.code, type: dep.type, criticality: dep.criticality, relation_type: dep.relation_type, level })
        findImpacted(dep.parent_id, level + 1)
      }
    }
  }

  findImpacted(ciId, 1)
  return impacted
}

async function getImpactAnalysisTurso(tursoDb, ciId) {
  const visited = new Set([ciId])
  const impacted = []

  async function findImpacted(currentId, level) {
    if (level > 3) return
    const result = await tursoDb.execute({
      sql: `SELECT r.parent_id, r.relation_type, c.name, c.code, c.type, c.criticality
            FROM ci_relations r JOIN configuration_items c ON r.parent_id = c.id WHERE r.child_id = ?`,
      args: [currentId]
    })

    for (const dep of result.rows) {
      if (!visited.has(dep.parent_id)) {
        visited.add(dep.parent_id)
        impacted.push({ ci_id: dep.parent_id, name: dep.name, code: dep.code, type: dep.type, criticality: dep.criticality, relation_type: dep.relation_type, level })
        await findImpacted(dep.parent_id, level + 1)
      }
    }
  }

  await findImpacted(ciId, 1)
  return impacted
}