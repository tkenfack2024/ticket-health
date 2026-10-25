import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================

export function initGdprTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gdpr_processing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      data_categories TEXT,
      purpose TEXT,
      legal_basis TEXT,
      data_subjects TEXT,
      recipients TEXT,
      retention_period TEXT,
      security_measures TEXT,
      data_location TEXT,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      updated_by TEXT
    )
  `)

  console.log('✅ Tables RGPD initialisées')
}

// ==================== ROUTES ====================

export function createGdprRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/gdpr/processing ----
  router.get('/processing', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute('SELECT * FROM gdpr_processing ORDER BY name ASC')
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET gdpr:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const processing = db.prepare('SELECT * FROM gdpr_processing ORDER BY name ASC').all()
    res.json(processing)
  })

  // ---- POST /api/gdpr/processing ----
  router.post('/processing', async (req, res) => {
    const {
      name, description, data_categories, purpose, legal_basis,
      data_subjects, recipients, retention_period, security_measures,
      data_location, is_sensitive,
    } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO gdpr_processing (
                  name, description, data_categories, purpose, legal_basis,
                  data_subjects, recipients, retention_period, security_measures,
                  data_location, is_sensitive, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            name.trim(), description?.trim() || null, data_categories?.trim() || null,
            purpose?.trim() || null, legal_basis?.trim() || null, data_subjects?.trim() || null,
            recipients?.trim() || null, retention_period?.trim() || null,
            security_measures?.trim() || null, data_location?.trim() || null,
            is_sensitive ? 1 : 0, req.user.name
          ]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'gdpr_processing', newId, `Traitement RGPD créé : ${name}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        console.error('Erreur Turso POST gdpr:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    try {
      const result = db.prepare(`
        INSERT INTO gdpr_processing (
          name, description, data_categories, purpose, legal_basis,
          data_subjects, recipients, retention_period, security_measures,
          data_location, is_sensitive, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(), description?.trim() || null, data_categories?.trim() || null,
        purpose?.trim() || null, legal_basis?.trim() || null, data_subjects?.trim() || null,
        recipients?.trim() || null, retention_period?.trim() || null,
        security_measures?.trim() || null, data_location?.trim() || null,
        is_sensitive ? 1 : 0, req.user.name
      )

      logAction(req.user.id, req.user.name, 'create', 'gdpr_processing', result.lastInsertRowid, `Traitement RGPD créé : ${name}`)
      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ---- PATCH /api/gdpr/processing/:id ----
  router.patch('/processing/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_processing WHERE id = ?', args: [targetId] })
        const existing = check.rows[0]
        if (!existing) return res.status(404).json({ error: 'Traitement non trouvé' })

        const allowed = [
          'name', 'description', 'data_categories', 'purpose', 'legal_basis',
          'data_subjects', 'recipients', 'retention_period', 'security_measures',
          'data_location', 'is_sensitive',
        ]
        const updates = []
        const args = []

        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'is_sensitive') args.push(req.body[field] ? 1 : 0)
            else args.push(req.body[field] || null)
          }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })

        updates.push('updated_at = datetime(\'now\', \'localtime\')')
        updates.push('updated_by = ?')
        args.push(req.user.name, targetId)

        await tursoDb.execute({ sql: `UPDATE gdpr_processing SET ${updates.join(', ')} WHERE id = ?`, args })

        logAction(req.user.id, req.user.name, 'update', 'gdpr_processing', targetId, `Traitement RGPD modifié : ${existing.name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso PATCH gdpr:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const existing = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(targetId)
    if (!existing) return res.status(404).json({ error: 'Traitement non trouvé' })

    const allowed = [
      'name', 'description', 'data_categories', 'purpose', 'legal_basis',
      'data_subjects', 'recipients', 'retention_period', 'security_measures',
      'data_location', 'is_sensitive',
    ]
    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'is_sensitive') values.push(req.body[field] ? 1 : 0)
        else values.push(req.body[field] || null)
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })

    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    updates.push('updated_by = ?')
    values.push(req.user.name, targetId)

    db.prepare(`UPDATE gdpr_processing SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    logAction(req.user.id, req.user.name, 'update', 'gdpr_processing', targetId, `Traitement RGPD modifié : ${existing.name}`)
    res.json({ success: true })
  })

  // ---- DELETE /api/gdpr/processing/:id ----
  router.delete('/processing/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_processing WHERE id = ?', args: [targetId] })
        const existing = check.rows[0]
        if (!existing) return res.status(404).json({ error: 'Traitement non trouvé' })

        await tursoDb.execute({ sql: 'DELETE FROM gdpr_processing WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'gdpr_processing', targetId, `Traitement RGPD supprimé : ${existing.name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE gdpr:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const existing = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(targetId)
    if (!existing) return res.status(404).json({ error: 'Traitement non trouvé' })

    db.prepare('DELETE FROM gdpr_processing WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'gdpr_processing', targetId, `Traitement RGPD supprimé : ${existing.name}`)
    res.json({ success: true })
  })

  // ---- GET /api/gdpr/export ----
  router.get('/export', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute('SELECT * FROM gdpr_processing ORDER BY name ASC')
        const data = {
          exported_at: new Date().toISOString(),
          tenant: tenant.name,
          processing_register: result.rows,
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="gdpr-${tenantId}-${Date.now()}.json"`)
        return res.send(JSON.stringify(data, null, 2))
      } catch (err) {
        console.error('Erreur Turso export gdpr:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const processing = db.prepare('SELECT * FROM gdpr_processing ORDER BY name ASC').all()
    const data = {
      exported_at: new Date().toISOString(),
      processing_register: processing,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-${Date.now()}.json"`)
    res.send(JSON.stringify(data, null, 2))
  })

  return router
}