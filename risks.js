import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { userHasPermission } from './knowledge.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// Version simplifiée pour Turso (car userHasPermission est synchrone)
async function userHasPermissionTurso(tursoDb, userId, role, code) {
  if (role === 'admin') return true
  const result = await tursoDb.execute({
    sql: 'SELECT permission_code FROM user_permissions WHERE user_id = ? AND permission_code = ?',
    args: [userId, code]
  })
  return result.rows.length > 0
}

export function initRiskTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      probability INTEGER NOT NULL CHECK(probability BETWEEN 1 AND 5),
      impact INTEGER NOT NULL CHECK(impact BETWEEN 1 AND 5),
      score INTEGER GENERATED ALWAYS AS (probability * impact) VIRTUAL,
      mitigation_plan TEXT,
      owner TEXT,
      status TEXT DEFAULT 'Ouvert' CHECK(status IN ('Ouvert', 'En cours', 'Mitigé', 'Clos')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    )
  `)
  console.log('✅ Tables Risques initialisées')
}

export function createRiskRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ==================== GET /api/risks ====================
  router.get('/', async (req, res) => {
    const { status, category } = req.query
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'risk.view')) {
          return res.status(403).json({ error: 'Permission risk.view requise' })
        }

        let query = 'SELECT * FROM risks WHERE 1=1'
        const args = []
        if (status) { query += ' AND status = ?'; args.push(status) }
        if (category) { query += ' AND category = ?'; args.push(category) }
        query += ' ORDER BY score DESC, id DESC'

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET risks:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'risk.view')) {
      return res.status(403).json({ error: 'Permission risk.view requise' })
    }

    let query = 'SELECT * FROM risks WHERE 1=1'
    const params = []
    if (status) { query += ' AND status = ?'; params.push(status) }
    if (category) { query += ' AND category = ?'; params.push(category) }
    query += ' ORDER BY score DESC, id DESC'

    const risks = db.prepare(query).all(...params)
    res.json(risks)
  })

  // ==================== POST /api/risks ====================
  router.post('/', async (req, res) => {
    const { title, description, category, probability, impact, mitigation_plan, owner, status } = req.body
    const { tenantId } = req.user

    if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est obligatoire' })
    if (!probability || probability < 1 || probability > 5) return res.status(400).json({ error: 'Probabilité invalide (1-5)' })
    if (!impact || impact < 1 || impact > 5) return res.status(400).json({ error: 'Impact invalide (1-5)' })

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'risk.create')) {
          return res.status(403).json({ error: 'Permission risk.create requise' })
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO risks (title, description, category, probability, impact, mitigation_plan, owner, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [title.trim(), description, category, probability, impact, mitigation_plan, owner, status || 'Ouvert']
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'risk', newId, `Risque créé : ${title}`)
        return res.status(201).json({ id: newId, success: true })
      } catch (err) {
        console.error('Erreur Turso POST risk:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'risk.create')) {
      return res.status(403).json({ error: 'Permission risk.create requise' })
    }

    const result = db.prepare(`
      INSERT INTO risks (title, description, category, probability, impact, mitigation_plan, owner, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), description, category, probability, impact, mitigation_plan, owner, status || 'Ouvert')

    logAction(req.user.id, req.user.name, 'create', 'risk', result.lastInsertRowid, `Risque créé : ${title}`)
    res.status(201).json({ id: result.lastInsertRowid, success: true })
  })

  // ==================== PATCH /api/risks/:id ====================
  router.patch('/:id', async (req, res) => {
    const { title, description, category, probability, impact, mitigation_plan, owner, status } = req.body
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'risk.edit')) {
          return res.status(403).json({ error: 'Permission risk.edit requise' })
        }

        const checkResult = await tursoDb.execute({ sql: 'SELECT * FROM risks WHERE id = ?', args: [req.params.id] })
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Risque non trouvé' })

        await tursoDb.execute({
          sql: `
            UPDATE risks SET
              title = COALESCE(?, title),
              description = COALESCE(?, description),
              category = COALESCE(?, category),
              probability = COALESCE(?, probability),
              impact = COALESCE(?, impact),
              mitigation_plan = COALESCE(?, mitigation_plan),
              owner = COALESCE(?, owner),
              status = COALESCE(?, status),
              updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `,
          args: [title, description, category, probability, impact, mitigation_plan, owner, status, req.params.id]
        })

        logAction(req.user.id, req.user.name, 'update', 'risk', req.params.id, `Risque modifié`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso PATCH risk:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'risk.edit')) {
      return res.status(403).json({ error: 'Permission risk.edit requise' })
    }

    const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id)
    if (!risk) return res.status(404).json({ error: 'Risque non trouvé' })

    db.prepare(`
      UPDATE risks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        probability = COALESCE(?, probability),
        impact = COALESCE(?, impact),
        mitigation_plan = COALESCE(?, mitigation_plan),
        owner = COALESCE(?, owner),
        status = COALESCE(?, status),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(title, description, category, probability, impact, mitigation_plan, owner, status, req.params.id)

    logAction(req.user.id, req.user.name, 'update', 'risk', req.params.id, `Risque modifié`)
    res.json({ success: true })
  })

  // ==================== DELETE /api/risks/:id ====================
  router.delete('/:id', async (req, res) => {
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'risk.delete')) {
          return res.status(403).json({ error: 'Permission risk.delete requise' })
        }

        const checkResult = await tursoDb.execute({ sql: 'SELECT * FROM risks WHERE id = ?', args: [req.params.id] })
        const risk = checkResult.rows[0]
        if (!risk) return res.status(404).json({ error: 'Risque non trouvé' })

        await tursoDb.execute({ sql: 'DELETE FROM risks WHERE id = ?', args: [req.params.id] })
        logAction(req.user.id, req.user.name, 'delete', 'risk', req.params.id, `Risque supprimé : ${risk.title}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE risk:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'risk.delete')) {
      return res.status(403).json({ error: 'Permission risk.delete requise' })
    }

    const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id)
    if (!risk) return res.status(404).json({ error: 'Risque non trouvé' })

    db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id)
    logAction(req.user.id, req.user.name, 'delete', 'risk', req.params.id, `Risque supprimé : ${risk.title}`)
    res.json({ success: true })
  })

  return router
}