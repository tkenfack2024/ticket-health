// backend/banners.js
import { Router } from 'express'
import { authRequired } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { userHasPermission, userHasPermissionTurso } from './knowledge.js'

// ==================== INITIALISATION ====================

export function initBannerTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      variant TEXT NOT NULL DEFAULT 'info' CHECK(variant IN ('info', 'success', 'warning', 'danger', 'fluo')),
      duration_seconds INTEGER NOT NULL DEFAULT 10,
      active INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT,
      created_by INTEGER,
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    )
  `)
  console.log('✅ Table system_banners initialisée')
}

// ==================== HELPERS ====================

function filterActiveByDate(banners) {
  const now = Date.now()
  return banners.filter(b => {
    const isActive = Number(b.active) === 1
    if (!isActive) return false

    if (b.starts_at) {
      const starts = new Date(b.starts_at).getTime()
      if (!isNaN(starts) && starts > now) return false
    }
    if (b.ends_at) {
      const ends = new Date(b.ends_at).getTime()
      if (!isNaN(ends) && ends < now) return false
    }
    return true
  })
}

// ==================== ROUTES ====================

export function createBannerRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ---- GET /api/banners/active ----
  router.get('/active', async (req, res) => {
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.read')) {
          return res.status(403).json({ error: 'Permission notifications.banner.read requise' })
        }

        const result = await tursoDb.execute(
          'SELECT id, title, message, variant, duration_seconds, active, starts_at, ends_at, updated_at, created_at FROM system_banners WHERE active = 1 ORDER BY id DESC LIMIT 10'
        )
        const banners = result.rows.map(b => ({ ...b, active: Number(b.active) }))
        return res.json(filterActiveByDate(banners))
      } catch (err) {
        console.error('Erreur Turso GET banners active:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.read')) {
      return res.status(403).json({ error: 'Permission notifications.banner.read requise' })
    }

    const rows = db.prepare(
      'SELECT id, title, message, variant, duration_seconds, active, starts_at, ends_at, updated_at, created_at FROM system_banners WHERE active = 1 ORDER BY id DESC LIMIT 10'
    ).all()
    res.json(filterActiveByDate(rows))
  })

  // ---- GET /api/banners ----
  router.get('/', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.manage')) {
          return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
        }
        const result = await tursoDb.execute('SELECT * FROM system_banners ORDER BY id DESC')
        const banners = result.rows.map(b => ({ ...b, active: Number(b.active) }))
        return res.json(banners)
      } catch (err) {
        console.error('Erreur Turso GET banners:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.manage')) {
      return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
    }
    const banners = db.prepare('SELECT * FROM system_banners ORDER BY id DESC').all()
    res.json(banners)
  })

  // ---- POST /api/banners ----
  router.post('/', async (req, res) => {
    const { title, message, variant, duration_seconds, starts_at, ends_at } = req.body
    const { tenantId } = req.user

    if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est obligatoire' })
    if (!message || !message.trim()) return res.status(400).json({ error: 'Le message est obligatoire' })
    if (variant && !['info', 'success', 'warning', 'danger', 'fluo'].includes(variant)) {
      return res.status(400).json({ error: 'Variante invalide' })
    }
    const duration = parseInt(duration_seconds) || 10

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.manage')) {
          return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
        }
        const result = await tursoDb.execute({
          sql: `INSERT INTO system_banners (title, message, variant, duration_seconds, starts_at, ends_at, created_by, created_by_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [title.trim(), message.trim(), variant || 'info', duration, starts_at || null, ends_at || null, req.user.id, req.user.name]
        })
        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'system_banner', newId, `Bannière créée : ${title}`)
        const newBanner = await tursoDb.execute({ sql: 'SELECT * FROM system_banners WHERE id = ?', args: [newId] })
        const banner = newBanner.rows[0]
        return res.status(201).json({ ...banner, active: Number(banner.active) })
      } catch (err) {
        console.error('Erreur Turso POST banner:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.manage')) {
      return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
    }
    const result = db.prepare(`
      INSERT INTO system_banners (title, message, variant, duration_seconds, starts_at, ends_at, created_by, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), message.trim(), variant || 'info', duration, starts_at || null, ends_at || null, req.user.id, req.user.name)
    logAction(req.user.id, req.user.name, 'create', 'system_banner', result.lastInsertRowid, `Bannière créée : ${title}`)
    const newBanner = db.prepare('SELECT * FROM system_banners WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newBanner)
  })

  // ---- PATCH /api/banners/:id ----
  router.patch('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (req.body.variant && !['info', 'success', 'warning', 'danger', 'fluo'].includes(req.body.variant)) {
      return res.status(400).json({ error: 'Variante invalide' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.manage')) {
          return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT * FROM system_banners WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Bannière non trouvée' })

        const allowed = ['title', 'message', 'variant', 'duration_seconds', 'active', 'starts_at', 'ends_at']
        const updates = []
        const args = []
        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'duration_seconds') args.push(parseInt(req.body[field]) || 0)
            else if (field === 'active') args.push(req.body[field] ? 1 : 0)
            else args.push(req.body[field] || null)
          }
        }
        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        updates.push("updated_at = datetime('now', 'localtime')")
        args.push(targetId)

        await tursoDb.execute({ sql: `UPDATE system_banners SET ${updates.join(', ')} WHERE id = ?`, args })
        logAction(req.user.id, req.user.name, 'update', 'system_banner', targetId, `Bannière modifiée`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM system_banners WHERE id = ?', args: [targetId] })
        const banner = updated.rows[0]
        return res.json({ ...banner, active: Number(banner.active) })
      } catch (err) {
        console.error('Erreur Turso PATCH banner:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.manage')) {
      return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
    }
    const existing = db.prepare('SELECT * FROM system_banners WHERE id = ?').get(targetId)
    if (!existing) return res.status(404).json({ error: 'Bannière non trouvée' })

    const allowed = ['title', 'message', 'variant', 'duration_seconds', 'active', 'starts_at', 'ends_at']
    const updates = []
    const values = []
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'duration_seconds') values.push(parseInt(req.body[field]) || 0)
        else if (field === 'active') values.push(req.body[field] ? 1 : 0)
        else values.push(req.body[field] || null)
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    updates.push("updated_at = datetime('now', 'localtime')")
    values.push(targetId)

    db.prepare(`UPDATE system_banners SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    logAction(req.user.id, req.user.name, 'update', 'system_banner', targetId, `Bannière modifiée`)
    const updated = db.prepare('SELECT * FROM system_banners WHERE id = ?').get(targetId)
    res.json(updated)
  })

  // ---- POST /api/banners/:id/toggle ----
  router.post('/:id/toggle', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.manage')) {
          return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT * FROM system_banners WHERE id = ?', args: [targetId] })
        const banner = check.rows[0]
        if (!banner) return res.status(404).json({ error: 'Bannière non trouvée' })

        const currentActive = Number(banner.active)
        const newActive = currentActive === 1 ? 0 : 1
        await tursoDb.execute({
          sql: "UPDATE system_banners SET active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
          args: [newActive, targetId]
        })
        logAction(req.user.id, req.user.name, newActive ? 'activate' : 'deactivate', 'system_banner', targetId, `Bannière ${newActive ? 'activée' : 'désactivée'}`)
        return res.json({ success: true, active: newActive })
      } catch (err) {
        console.error('Erreur Turso toggle banner:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.manage')) {
      return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
    }
    const banner = db.prepare('SELECT * FROM system_banners WHERE id = ?').get(targetId)
    if (!banner) return res.status(404).json({ error: 'Bannière non trouvée' })

    const newActive = banner.active === 1 ? 0 : 1
    db.prepare("UPDATE system_banners SET active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newActive, targetId)
    logAction(req.user.id, req.user.name, newActive ? 'activate' : 'deactivate', 'system_banner', targetId, `Bannière ${newActive ? 'activée' : 'désactivée'}`)
    res.json({ success: true, active: newActive })
  })

  // ---- DELETE /api/banners/:id ----
  router.delete('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'notifications.banner.manage')) {
          return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
        }
        const check = await tursoDb.execute({ sql: 'SELECT * FROM system_banners WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Bannière non trouvée' })

        await tursoDb.execute({ sql: 'DELETE FROM system_banners WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'system_banner', targetId, 'Bannière supprimée')
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE banner:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    if (!userHasPermission(db, req.user.id, req.user.role, 'notifications.banner.manage')) {
      return res.status(403).json({ error: 'Permission notifications.banner.manage requise' })
    }
    const existing = db.prepare('SELECT * FROM system_banners WHERE id = ?').get(targetId)
    if (!existing) return res.status(404).json({ error: 'Bannière non trouvée' })

    db.prepare('DELETE FROM system_banners WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'system_banner', targetId, 'Bannière supprimée')
    res.json({ success: true })
  })

  return router
}