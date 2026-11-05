import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { userHasPermission, userHasPermissionTurso } from './knowledge.js'
import { logActionTurso } from './logger.js'

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

  // ✅ NOUVEAU : Table AIPD / DPIA (Art. 35 RGPD)
  db.exec(`
    CREATE TABLE IF NOT EXISTS gdpr_dpia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      processing_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'in_progress', 'validated', 'rejected')),
      context TEXT,
      risks TEXT,
      security_measures TEXT,
      dpo_name TEXT,
      dpo_validated_at TEXT,
      dpo_comments TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (processing_id) REFERENCES gdpr_processing(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables RGPD + AIPD initialisées')
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
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'gdpr_processing', newId, `Traitement RGPD créé : ${name}`)
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

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'gdpr_processing', targetId, `Traitement RGPD modifié : ${existing.name}`)
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
                await logActionTurso(tursoDb, req.user.id, req.user.name, 'delete', 'gdpr_processing', targetId, `Traitement RGPD supprimé : ${existing.name}`)
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

  // ==================== AIPD / DPIA (Art. 35 RGPD) ====================

  // ---- GET /api/gdpr/processing/:id/dpia ----
  // Récupérer l'AIPD d'un traitement (ou null si inexistante)
  router.get('/processing/:id/dpia', async (req, res) => {
    const { tenantId } = req.user
    const processingId = parseInt(req.params.id)

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'gdpr.dpia.read')) {
          return res.status(403).json({ error: 'Permission gdpr.dpia.read requise' })
        }

        const check = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_processing WHERE id = ?', args: [processingId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Traitement non trouvé' })

        const result = await tursoDb.execute({
          sql: 'SELECT * FROM gdpr_dpia WHERE processing_id = ? ORDER BY id DESC LIMIT 1',
          args: [processingId]
        })
        const dpia = result.rows[0] || null

        if (dpia) {
          try { dpia.context = dpia.context ? JSON.parse(dpia.context) : null } catch { dpia.context = null }
          try { dpia.risks = dpia.risks ? JSON.parse(dpia.risks) : [] } catch { dpia.risks = [] }
          try { dpia.security_measures = dpia.security_measures ? JSON.parse(dpia.security_measures) : [] } catch { dpia.security_measures = [] }
        }
        return res.json(dpia)
      } catch (err) {
        console.error('Erreur Turso GET dpia:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'gdpr.dpia.read')) {
      return res.status(403).json({ error: 'Permission gdpr.dpia.read requise' })
    }
    const processing = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(processingId)
    if (!processing) return res.status(404).json({ error: 'Traitement non trouvé' })

    const dpia = db.prepare('SELECT * FROM gdpr_dpia WHERE processing_id = ? ORDER BY id DESC LIMIT 1').get(processingId)
    if (dpia) {
      try { dpia.context = dpia.context ? JSON.parse(dpia.context) : null } catch { dpia.context = null }
      try { dpia.risks = dpia.risks ? JSON.parse(dpia.risks) : [] } catch { dpia.risks = [] }
      try { dpia.security_measures = dpia.security_measures ? JSON.parse(dpia.security_measures) : [] } catch { dpia.security_measures = [] }
    }
    res.json(dpia || null)
  })

  // ---- POST /api/gdpr/processing/:id/dpia ----
  // Créer une AIPD pour un traitement
  router.post('/processing/:id/dpia', async (req, res) => {
    const { tenantId } = req.user
    const processingId = parseInt(req.params.id)
    const { context, risks, security_measures } = req.body

    const contextStr = context ? JSON.stringify(context) : null
    const risksStr = risks ? JSON.stringify(risks) : null
    const measuresStr = security_measures ? JSON.stringify(security_measures) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'gdpr.dpia.manage')) {
          return res.status(403).json({ error: 'Permission gdpr.dpia.manage requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT id FROM gdpr_processing WHERE id = ?', args: [processingId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Traitement non trouvé' })

        const existing = await tursoDb.execute({
          sql: "SELECT id FROM gdpr_dpia WHERE processing_id = ? AND status != 'validated' ORDER BY id DESC LIMIT 1",
          args: [processingId]
        })
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Une AIPD existe déjà pour ce traitement (non validée)', id: existing.rows[0].id })
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO gdpr_dpia (processing_id, status, context, risks, security_measures)
                VALUES (?, 'draft', ?, ?, ?)`,
          args: [processingId, contextStr, risksStr, measuresStr]
        })
                const newId = Number(result.lastInsertRowid)
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'gdpr_dpia', newId, `AIPD créée pour traitement #${processingId}`)
        const newDpia = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_dpia WHERE id = ?', args: [newId] })
        return res.status(201).json(newDpia.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST dpia:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'gdpr.dpia.manage')) {
      return res.status(403).json({ error: 'Permission gdpr.dpia.manage requise' })
    }
    const processing = db.prepare('SELECT id FROM gdpr_processing WHERE id = ?').get(processingId)
    if (!processing) return res.status(404).json({ error: 'Traitement non trouvé' })

    const existing = db.prepare("SELECT id FROM gdpr_dpia WHERE processing_id = ? AND status != 'validated' ORDER BY id DESC LIMIT 1").get(processingId)
    if (existing) return res.status(409).json({ error: 'Une AIPD existe déjà pour ce traitement (non validée)', id: existing.id })

    const result = db.prepare(`
      INSERT INTO gdpr_dpia (processing_id, status, context, risks, security_measures)
      VALUES (?, 'draft', ?, ?, ?)
    `).run(processingId, contextStr, risksStr, measuresStr)

    const newDpia = db.prepare('SELECT * FROM gdpr_dpia WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'gdpr_dpia', newDpia.id, `AIPD créée pour traitement #${processingId}`)
    res.status(201).json(newDpia)
  })

  // ---- PATCH /api/gdpr/dpia/:id ----
  // Modifier une AIPD (brouillon ou en cours)
  router.patch('/dpia/:id', async (req, res) => {
    const { tenantId } = req.user
    const targetId = parseInt(req.params.id)
    const { context, risks, security_measures, status } = req.body

    if (status && !['draft', 'in_progress', 'validated', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'gdpr.dpia.manage')) {
          return res.status(403).json({ error: 'Permission gdpr.dpia.manage requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_dpia WHERE id = ?', args: [targetId] })
        const dpia = check.rows[0]
        if (!dpia) return res.status(404).json({ error: 'AIPD non trouvée' })

        const allowed = ['context', 'risks', 'security_measures', 'status']
        const updates = []
        const args = []
        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'context' || field === 'risks' || field === 'security_measures') {
              args.push(req.body[field] ? JSON.stringify(req.body[field]) : null)
            } else {
              args.push(req.body[field])
            }
          }
        }
        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        updates.push("updated_at = datetime('now', 'localtime')")
        args.push(targetId)
        await tursoDb.execute({ sql: `UPDATE gdpr_dpia SET ${updates.join(', ')} WHERE id = ?`, args })
                await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'gdpr_dpia', targetId, `AIPD modifiée`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_dpia WHERE id = ?', args: [targetId] })
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso PATCH dpia:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'gdpr.dpia.manage')) {
      return res.status(403).json({ error: 'Permission gdpr.dpia.manage requise' })
    }
    const dpia = db.prepare('SELECT * FROM gdpr_dpia WHERE id = ?').get(targetId)
    if (!dpia) return res.status(404).json({ error: 'AIPD non trouvée' })

    const allowed = ['context', 'risks', 'security_measures', 'status']
    const updates = []
    const values = []
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'context' || field === 'risks' || field === 'security_measures') {
          values.push(req.body[field] ? JSON.stringify(req.body[field]) : null)
        } else {
          values.push(req.body[field])
        }
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    updates.push("updated_at = datetime('now', 'localtime')")
    values.push(targetId)
    db.prepare(`UPDATE gdpr_dpia SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const updated = db.prepare('SELECT * FROM gdpr_dpia WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'gdpr_dpia', targetId, `AIPD modifiée`)
    res.json(updated)
  })

  // ---- POST /api/gdpr/dpia/:id/validate ----
  // Valider ou rejeter une AIPD (DPO)
  router.post('/dpia/:id/validate', async (req, res) => {
    const { tenantId } = req.user
    const targetId = parseInt(req.params.id)
    const { decision, comments } = req.body

    if (!['validated', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Décision invalide (validated ou rejected)' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'gdpr.dpia.validate')) {
          return res.status(403).json({ error: 'Permission gdpr.dpia.validate requise (DPO)' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_dpia WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'AIPD non trouvée' })

        await tursoDb.execute({
          sql: `UPDATE gdpr_dpia
                SET status = ?, dpo_name = ?, dpo_validated_at = datetime('now', 'localtime'),
                    dpo_comments = ?, updated_at = datetime('now', 'localtime')
                WHERE id = ?`,
          args: [decision, req.user.name, comments || null, targetId]
        })
                await logActionTurso(tursoDb, req.user.id, req.user.name, decision === 'validated' ? 'approve' : 'reject', 'gdpr_dpia', targetId, `AIPD ${decision === 'validated' ? 'validée' : 'rejetée'}`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM gdpr_dpia WHERE id = ?', args: [targetId] })
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso validate dpia:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'gdpr.dpia.validate')) {
      return res.status(403).json({ error: 'Permission gdpr.dpia.validate requise (DPO)' })
    }
    const dpia = db.prepare('SELECT * FROM gdpr_dpia WHERE id = ?').get(targetId)
    if (!dpia) return res.status(404).json({ error: 'AIPD non trouvée' })

    db.prepare(`
      UPDATE gdpr_dpia
      SET status = ?, dpo_name = ?, dpo_validated_at = datetime('now', 'localtime'),
          dpo_comments = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(decision, req.user.name, comments || null, targetId)

    const updated = db.prepare('SELECT * FROM gdpr_dpia WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, decision === 'validated' ? 'approve' : 'reject', 'gdpr_dpia', targetId, `AIPD ${decision === 'validated' ? 'validée' : 'rejetée'}`)
    res.json(updated)
  })

  // ---- GET /api/gdpr/dpia ----
  // Liste toutes les AIPD
  router.get('/dpia', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'gdpr.dpia.read')) {
          return res.status(403).json({ error: 'Permission gdpr.dpia.read requise' })
        }
        const result = await tursoDb.execute(`
          SELECT d.*, p.name as processing_name, p.is_sensitive as processing_is_sensitive
          FROM gdpr_dpia d
          JOIN gdpr_processing p ON d.processing_id = p.id
          ORDER BY d.id DESC
        `)
        const rows = result.rows.map(r => {
          try { r.risks = r.risks ? JSON.parse(r.risks) : [] } catch { r.risks = [] }
          return r
        })
        return res.json(rows)
      } catch (err) {
        console.error('Erreur Turso GET all dpia:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'gdpr.dpia.read')) {
      return res.status(403).json({ error: 'Permission gdpr.dpia.read requise' })
    }
    const rows = db.prepare(`
      SELECT d.*, p.name as processing_name, p.is_sensitive as processing_is_sensitive
      FROM gdpr_dpia d
      JOIN gdpr_processing p ON d.processing_id = p.id
      ORDER BY d.id DESC
    `).all()
    for (const r of rows) {
      try { r.risks = r.risks ? JSON.parse(r.risks) : [] } catch { r.risks = [] }
    }
    res.json(rows)
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