import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { userHasPermission, userHasPermissionTurso } from './knowledge.js'
import { logActionTurso } from './logger.js'

// ==================== INITIALISATION ====================

export function initIctSupplierTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ict_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      service_type TEXT,
      service_description TEXT,
      criticality TEXT NOT NULL DEFAULT 'Standard' CHECK(criticality IN ('Critique', 'Important', 'Standard')),
      country TEXT,
      dpa_signed INTEGER NOT NULL DEFAULT 0,
      dpa_date TEXT,
      contract_start TEXT,
      contract_end TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      data_location TEXT,
      exit_plan TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Actif' CHECK(status IN ('Actif', 'Inactif', 'En évaluation')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    )
  `)
  console.log('✅ Tables Tiers ICT (DORA) initialisées')
}

// ==================== ROUTES ====================

export function createIctSupplierRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ---- GET /api/ict-suppliers ----
  router.get('/', async (req, res) => {
    const { status, criticality } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'ict_suppliers.list')) {
          return res.status(403).json({ error: 'Permission ict_suppliers.list requise' })
        }

        let query = 'SELECT * FROM ict_suppliers WHERE 1=1'
        const args = []
        if (status) { query += ' AND status = ?'; args.push(status) }
        if (criticality) { query += ' AND criticality = ?'; args.push(criticality) }
        query += ' ORDER BY criticality DESC, name ASC'

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET ict_suppliers:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'ict_suppliers.list')) {
      return res.status(403).json({ error: 'Permission ict_suppliers.list requise' })
    }

    let query = 'SELECT * FROM ict_suppliers WHERE 1=1'
    const params = []
    if (status) { query += ' AND status = ?'; params.push(status) }
    if (criticality) { query += ' AND criticality = ?'; params.push(criticality) }
    query += ' ORDER BY criticality DESC, name ASC'

    const suppliers = db.prepare(query).all(...params)
    res.json(suppliers)
  })

  // ---- POST /api/ict-suppliers ----
  router.post('/', async (req, res) => {
    const {
      name, service_type, service_description, criticality, country,
      dpa_signed, dpa_date, contract_start, contract_end,
      contact_name, contact_email, contact_phone,
      data_location, exit_plan, notes, status,
    } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })
    if (criticality && !['Critique', 'Important', 'Standard'].includes(criticality)) {
      return res.status(400).json({ error: 'Criticité invalide' })
    }

    const dpaInt = dpa_signed ? 1 : 0

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'ict_suppliers.create')) {
          return res.status(403).json({ error: 'Permission ict_suppliers.create requise' })
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO ict_suppliers (
                  name, service_type, service_description, criticality, country,
                  dpa_signed, dpa_date, contract_start, contract_end,
                  contact_name, contact_email, contact_phone,
                  data_location, exit_plan, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            name.trim(), service_type || null, service_description || null,
            criticality || 'Standard', country || null,
            dpaInt, dpa_date || null, contract_start || null, contract_end || null,
            contact_name || null, contact_email || null, contact_phone || null,
            data_location || null, exit_plan || null, notes || null, status || 'Actif',
          ],
        })

                const newId = Number(result.lastInsertRowid)
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'ict_supplier', newId, `Tiers ICT créé : ${name}`)
        const newSupplier = await tursoDb.execute({ sql: 'SELECT * FROM ict_suppliers WHERE id = ?', args: [newId] })
        return res.status(201).json(newSupplier.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST ict_supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'ict_suppliers.create')) {
      return res.status(403).json({ error: 'Permission ict_suppliers.create requise' })
    }

    const result = db.prepare(`
      INSERT INTO ict_suppliers (
        name, service_type, service_description, criticality, country,
        dpa_signed, dpa_date, contract_start, contract_end,
        contact_name, contact_email, contact_phone,
        data_location, exit_plan, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), service_type || null, service_description || null,
      criticality || 'Standard', country || null,
      dpaInt, dpa_date || null, contract_start || null, contract_end || null,
      contact_name || null, contact_email || null, contact_phone || null,
      data_location || null, exit_plan || null, notes || null, status || 'Actif'
    )

    logAction(req.user.id, req.user.name, 'create', 'ict_supplier', result.lastInsertRowid, `Tiers ICT créé : ${name}`)
    const newSupplier = db.prepare('SELECT * FROM ict_suppliers WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newSupplier)
  })

  // ---- PATCH /api/ict-suppliers/:id ----
  router.patch('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'ict_suppliers.edit')) {
          return res.status(403).json({ error: 'Permission ict_suppliers.edit requise' })
        }

        const check = await tursoDb.execute({ sql: 'SELECT * FROM ict_suppliers WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Tiers ICT non trouvé' })

        const allowed = [
          'name', 'service_type', 'service_description', 'criticality', 'country',
          'dpa_signed', 'dpa_date', 'contract_start', 'contract_end',
          'contact_name', 'contact_email', 'contact_phone',
          'data_location', 'exit_plan', 'notes', 'status',
        ]
        const updates = []
        const args = []
        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'dpa_signed') args.push(req.body[field] ? 1 : 0)
            else args.push(req.body[field] || null)
          }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        updates.push("updated_at = datetime('now', 'localtime')")
        args.push(targetId)

        await tursoDb.execute({ sql: `UPDATE ict_suppliers SET ${updates.join(', ')} WHERE id = ?`, args })
               await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'ict_supplier', targetId, `Tiers ICT modifié`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM ict_suppliers WHERE id = ?', args: [targetId] })
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso PATCH ict_supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'ict_suppliers.edit')) {
      return res.status(403).json({ error: 'Permission ict_suppliers.edit requise' })
    }

    const existing = db.prepare('SELECT * FROM ict_suppliers WHERE id = ?').get(targetId)
    if (!existing) return res.status(404).json({ error: 'Tiers ICT non trouvé' })

    const allowed = [
      'name', 'service_type', 'service_description', 'criticality', 'country',
      'dpa_signed', 'dpa_date', 'contract_start', 'contract_end',
      'contact_name', 'contact_email', 'contact_phone',
      'data_location', 'exit_plan', 'notes', 'status',
    ]
    const updates = []
    const values = []
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'dpa_signed') values.push(req.body[field] ? 1 : 0)
        else values.push(req.body[field] || null)
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    updates.push("updated_at = datetime('now', 'localtime')")
    values.push(targetId)

    db.prepare(`UPDATE ict_suppliers SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    logAction(req.user.id, req.user.name, 'update', 'ict_supplier', targetId, `Tiers ICT modifié`)
    const updated = db.prepare('SELECT * FROM ict_suppliers WHERE id = ?').get(targetId)
    res.json(updated)
  })

  // ---- DELETE /api/ict-suppliers/:id ----
  router.delete('/:id', adminOnly, async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'ict_suppliers.delete')) {
          return res.status(403).json({ error: 'Permission ict_suppliers.delete requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT name FROM ict_suppliers WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Tiers ICT non trouvé' })

               await tursoDb.execute({ sql: 'DELETE FROM ict_suppliers WHERE id = ?', args: [targetId] })
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'delete', 'ict_supplier', targetId, `Tiers ICT supprimé`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE ict_supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'ict_suppliers.delete')) {
      return res.status(403).json({ error: 'Permission ict_suppliers.delete requise' })
    }
    const supplier = db.prepare('SELECT name FROM ict_suppliers WHERE id = ?').get(targetId)
    if (!supplier) return res.status(404).json({ error: 'Tiers ICT non trouvé' })

    db.prepare('DELETE FROM ict_suppliers WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'ict_supplier', targetId, `Tiers ICT supprimé`)
    res.json({ success: true })
  })

  return router
}