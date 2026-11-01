import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authRequired, adminOnly } from './auth.js'
import multer from 'multer'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { userHasPermission, userHasPermissionTurso } from './knowledge.js'
import { logActionTurso } from './logger.js'

export function createAdminRouter(db, logAction) {
  const router = Router()

  // Toutes les routes admin nécessitent auth + rôle admin (sauf permissions granulaires)
  router.use(authRequired, adminOnly)

  // Migration : colonnes de revue des logs
  const logColumns = db.prepare('PRAGMA table_info(logs)').all().map(c => c.name)
  if (!logColumns.includes('reviewed')) db.exec('ALTER TABLE logs ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0')
  if (!logColumns.includes('reviewed_by')) db.exec('ALTER TABLE logs ADD COLUMN reviewed_by TEXT')
  if (!logColumns.includes('reviewed_at')) db.exec('ALTER TABLE logs ADD COLUMN reviewed_at TEXT')

  // ---- GET /api/admin/users ----
  router.get('/users', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.list')) {
          return res.status(403).json({ error: 'Permission users.list requise' })
        }
        const result = await tursoDb.execute(`
          SELECT id, name, email, phone, role, custom_role, active, created_at
          FROM users ORDER BY id DESC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET users:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    if (!userHasPermission(db, req.user.id, req.user.role, 'users.list')) {
      return res.status(403).json({ error: 'Permission users.list requise' })
    }
    const users = db.prepare(`
      SELECT id, name, email, phone, role, custom_role, active, created_at
      FROM users ORDER BY id DESC
    `).all()
    res.json(users)
  })

  // ---- POST /api/admin/users ----
  router.post('/users', async (req, res) => {
    const { name, email, phone, password, role, custom_role } = req.body
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.create')) {
          return res.status(403).json({ error: 'Permission users.create requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.create')) {
        return res.status(403).json({ error: 'Permission users.create requise' })
      }
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' })
    }
    if (role && !['admin', 'technicien', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rôle de base invalide' })
    }

    const hash = bcrypt.hashSync(password, 10)

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (custom_role) {
          const roleExists = await tursoDb.execute({ sql: 'SELECT id FROM roles WHERE name = ?', args: [custom_role] })
          if (roleExists.rows.length === 0) return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
        }

        const existing = await tursoDb.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase().trim()] })
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Cet email est déjà utilisé' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO users (name, email, phone, password_hash, role, custom_role) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [name.trim(), email.toLowerCase().trim(), phone || null, hash, role || 'user', custom_role || null]
        })

        const newUserId = Number(result.lastInsertRowid)
        const newUserResult = await tursoDb.execute({
          sql: 'SELECT id, name, email, phone, role, custom_role, active, created_at FROM users WHERE id = ?',
          args: [newUserId]
        })
        const newUser = newUserResult.rows[0]

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'user', newUserId, `Nouvel utilisateur : ${newUser.email} (${newUser.role}) [Turso]`)
        return res.status(201).json(newUser)
      } catch (err) {
        console.error('Erreur Turso POST user:', err)
        return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' })
      }
    }

    // --- MODE SQLITE ---
    if (custom_role) {
      const roleExists = db.prepare('SELECT id FROM roles WHERE name = ?').get(custom_role)
      if (!roleExists) return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' })

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, custom_role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), phone || null, hash, role || 'user', custom_role || null)

    const newUser = db.prepare(`SELECT id, name, email, phone, role, custom_role, active, created_at FROM users WHERE id = ?`).get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'user', newUser.id, `Nouvel utilisateur : ${newUser.email} (${newUser.role}${newUser.custom_role ? ' / ' + newUser.custom_role : ''})`)
    res.status(201).json(newUser)
  })

  // ---- PATCH /api/admin/users/:id ----
  router.patch('/users/:id', async (req, res) => {
    const { name, phone, role, custom_role, active } = req.body
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.edit')) {
          return res.status(403).json({ error: 'Permission users.edit requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.edit')) {
        return res.status(403).json({ error: 'Permission users.edit requise' })
      }
    }

    if (role && !['admin', 'technicien', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rôle de base invalide' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

        if (targetId === req.user.id && role && role !== 'admin') {
          return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
        }

        if (custom_role) {
          const roleExists = await tursoDb.execute({ sql: 'SELECT id FROM roles WHERE name = ?', args: [custom_role] })
          if (roleExists.rows.length === 0) return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
        }

        await tursoDb.execute({
          sql: `
            UPDATE users SET
              name = COALESCE(?, name),
              phone = COALESCE(?, phone),
              role = COALESCE(?, role),
              custom_role = CASE WHEN ? = '__CLEAR__' THEN NULL ELSE COALESCE(?, custom_role) END,
              active = COALESCE(?, active)
            WHERE id = ?
          `,
          args: [name || null, phone !== undefined ? phone : null, role || null,
                 custom_role === null ? '__CLEAR__' : 'NO_CHANGE', custom_role || null,
                 active !== undefined ? (active ? 1 : 0) : null, targetId]
        })

        const updated = await tursoDb.execute({
          sql: 'SELECT id, name, email, phone, role, custom_role, active, created_at FROM users WHERE id = ?',
          args: [targetId]
        })
        const u = updated.rows[0]

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'user', targetId, `Utilisateur modifié : ${u.email} (${u.role}${u.custom_role ? ' / ' + u.custom_role : ''}, ${u.active ? 'actif' : 'désactivé'}) [Turso]`)
        return res.json(u)
      } catch (err) {
        console.error('Erreur Turso PATCH user:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    if (targetId === req.user.id && role && role !== 'admin') {
      return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
    }

    if (custom_role && custom_role !== null) {
      const roleExists = db.prepare('SELECT id FROM roles WHERE name = ?').get(custom_role)
      if (!roleExists) return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
    }

    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        custom_role = CASE WHEN ? = '__CLEAR__' THEN NULL ELSE COALESCE(?, custom_role) END,
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name || null, phone !== undefined ? phone : null, role || null,
           custom_role === null ? '__CLEAR__' : 'NO_CHANGE', custom_role || null,
           active !== undefined ? (active ? 1 : 0) : null, targetId)

    const updated = db.prepare(`SELECT id, name, email, phone, role, custom_role, active, created_at FROM users WHERE id = ?`).get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'user', targetId, `Utilisateur modifié : ${updated.email} (${updated.role}${updated.custom_role ? ' / ' + updated.custom_role : ''}, ${updated.active ? 'actif' : 'désactivé'})`)
    res.json(updated)
  })

  // ---- POST /api/admin/users/:id/reset-password ----
  router.post('/users/:id/reset-password', async (req, res) => {
    const { newPassword } = req.body
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.reset_password')) {
          return res.status(403).json({ error: 'Permission users.reset_password requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.reset_password')) {
        return res.status(403).json({ error: 'Permission users.reset_password requise' })
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
    }

    const hash = bcrypt.hashSync(newPassword, 10)

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id, email FROM users WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

        await tursoDb.execute({
          sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
          args: [hash, targetId]
        })

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'reset-password', 'user', targetId, `Mot de passe réinitialisé : ${target.email} [Turso]`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso reset password:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetId)
    logAction(req.user.id, req.user.name, 'reset-password', 'user', targetId, `Mot de passe réinitialisé : ${target.email}`)
    res.json({ success: true })
  })

  // ---- DELETE /api/admin/users/:id (Désactivation) ----
  router.delete('/users/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.delete')) {
          return res.status(403).json({ error: 'Permission users.delete requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.delete')) {
        return res.status(403).json({ error: 'Permission users.delete requise' })
      }
    }

    if (targetId === req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id, email FROM users WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'deactivate', 'user', targetId, `Utilisateur désactivé : ${target.email} [Turso]`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE user:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'deactivate', 'user', targetId, `Utilisateur désactivé : ${target.email}`)
    res.json({ success: true })
  })
  // ==================== MODULES ====================

  // ---- GET /api/admin/modules ----
  router.get('/modules', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.list')) {
          return res.status(403).json({ error: 'Permission tickets.list requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.list')) {
        return res.status(403).json({ error: 'Permission tickets.list requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT m.*, 
            (SELECT COUNT(*) FROM tickets WHERE module_id = m.id OR category = m.name) as ticket_count
          FROM modules m ORDER BY m.id ASC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET modules:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const modules = db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM tickets WHERE module_id = m.id OR category = m.name) as ticket_count
      FROM modules m ORDER BY m.id ASC
    `).all()
    res.json(modules)
  })

  // ---- POST /api/admin/modules ----
  router.post('/modules', async (req, res) => {
    const { name, description, icon, color } = req.body
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.create')) {
          return res.status(403).json({ error: 'Permission tickets.create requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.create')) {
        return res.status(403).json({ error: 'Permission tickets.create requise' })
      }
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const existing = await tursoDb.execute({ sql: 'SELECT id FROM modules WHERE LOWER(name) = ?', args: [name.toLowerCase().trim()] })
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO modules (name, description, icon, color) VALUES (?, ?, ?, ?)`,
          args: [name.trim(), description?.trim() || null, icon || 'Box', color || 'slate']
        })

        const newId = Number(result.lastInsertRowid)
        const newModule = await tursoDb.execute({ sql: 'SELECT * FROM modules WHERE id = ?', args: [newId] })
               await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'module', newId, `Module créé : ${name}`)
        return res.status(201).json(newModule.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST module:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const existing = db.prepare('SELECT id FROM modules WHERE LOWER(name) = ?').get(name.toLowerCase().trim())
    if (existing) return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })

    const result = db.prepare(`
      INSERT INTO modules (name, description, icon, color) VALUES (?, ?, ?, ?)
    `).run(name.trim(), description?.trim() || null, icon || 'Box', color || 'slate')

    const newModule = db.prepare('SELECT * FROM modules WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'module', newModule.id, `Module créé : ${newModule.name}`)
    res.status(201).json(newModule)
  })

  // ---- PATCH /api/admin/modules/:id ----
  router.patch('/modules/:id', async (req, res) => {
    const { name, description, icon, color, active } = req.body
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.edit')) {
          return res.status(403).json({ error: 'Permission tickets.edit requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.edit')) {
        return res.status(403).json({ error: 'Permission tickets.edit requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM modules WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Module non trouvé' })

        if (name && name.toLowerCase().trim() !== target.name.toLowerCase()) {
          const existing = await tursoDb.execute({ sql: 'SELECT id FROM modules WHERE LOWER(name) = ? AND id != ?', args: [name.toLowerCase().trim(), targetId] })
          if (existing.rows.length > 0) return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })
        }

        await tursoDb.execute({
          sql: `
            UPDATE modules SET
              name = COALESCE(?, name),
              description = COALESCE(?, description),
              icon = COALESCE(?, icon),
              color = COALESCE(?, color),
              active = COALESCE(?, active)
            WHERE id = ?
          `,
          args: [name?.trim() || null, description !== undefined ? description : null,
                 icon || null, color || null,
                 active !== undefined ? (active ? 1 : 0) : null, targetId]
        })

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'module', targetId, `Module modifié : ${updated.rows[0].name}`)
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso PATCH module:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Module non trouvé' })

    if (name && name.toLowerCase().trim() !== target.name.toLowerCase()) {
      const existing = db.prepare('SELECT id FROM modules WHERE LOWER(name) = ? AND id != ?').get(name.toLowerCase().trim(), targetId)
      if (existing) return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })
    }

    db.prepare(`
      UPDATE modules SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name?.trim() || null, description !== undefined ? description : null,
           icon || null, color || null,
           active !== undefined ? (active ? 1 : 0) : null, targetId)

    const updated = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'module', targetId, `Module modifié : ${updated.name}`)
    res.json(updated)
  })

  // ---- DELETE /api/admin/modules/:id ----
  router.delete('/modules/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.delete')) {
          return res.status(403).json({ error: 'Permission tickets.delete requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.delete')) {
        return res.status(403).json({ error: 'Permission tickets.delete requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM modules WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Module non trouvé' })

        const ticketCountResult = await tursoDb.execute({ sql: 'SELECT COUNT(*) as c FROM tickets WHERE category = ?', args: [target.name] })
        const ticketCount = ticketCountResult.rows[0].c

                if (ticketCount > 0) {
          await tursoDb.execute({ sql: 'UPDATE modules SET active = 0 WHERE id = ?', args: [targetId] })
          await logActionTurso(tursoDb, req.user.id, req.user.name, 'deactivate', 'module', targetId, `Module désactivé (${ticketCount} tickets liés) : ${target.name}`)
          return res.json({ success: true, deactivated: true, ticketCount })
        }

        await tursoDb.execute({ sql: 'DELETE FROM modules WHERE id = ?', args: [targetId] })
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'delete', 'module', targetId, `Module supprimé : ${target.name}`)
        return res.json({ success: true, deleted: true })
      } catch (err) {
        console.error('Erreur Turso DELETE module:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Module non trouvé' })

    const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE category = ?').get(target.name).c

    if (ticketCount > 0) {
      db.prepare('UPDATE modules SET active = 0 WHERE id = ?').run(targetId)
      logAction(req.user.id, req.user.name, 'deactivate', 'module', targetId, `Module désactivé (${ticketCount} tickets liés) : ${target.name}`)
      return res.json({ success: true, deactivated: true, ticketCount })
    }

    db.prepare('DELETE FROM modules WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'module', targetId, `Module supprimé : ${target.name}`)
    res.json({ success: true, deleted: true })
  })

  // ==================== ASSETS ====================

  // ---- GET /api/admin/assets ----
  router.get('/assets', async (req, res) => {
    const { type, status, search } = req.query
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.list')) {
          return res.status(403).json({ error: 'Permission assets.list requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.list')) {
        return res.status(403).json({ error: 'Permission assets.list requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT a.*, u.name as assigned_to_name
          FROM assets a
          LEFT JOIN users u ON a.assigned_to = u.id
          WHERE 1=1
        `
        const args = []
        if (type && ['hardware', 'software'].includes(type)) { query += ' AND a.type = ?'; args.push(type) }
        if (status) { query += ' AND a.status = ?'; args.push(status) }
        if (search) {
          query += ' AND (a.name LIKE ? OR a.brand LIKE ? OR a.serial_number LIKE ? OR a.editor LIKE ?)'
          const s = `%${search}%`
          args.push(s, s, s, s)
        }
        query += ' ORDER BY a.id DESC'

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET assets:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = `
      SELECT a.*, u.name as assigned_to_name
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE 1=1
    `
    const params = []
    if (type && ['hardware', 'software'].includes(type)) { query += ' AND a.type = ?'; params.push(type) }
    if (status) { query += ' AND a.status = ?'; params.push(status) }
    if (search) {
      query += ' AND (a.name LIKE ? OR a.brand LIKE ? OR a.serial_number LIKE ? OR a.editor LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s)
    }
    query += ' ORDER BY a.id DESC'

    const assets = db.prepare(query).all(...params)
    res.json(assets)
  })

  // ---- GET /api/admin/assets/:id ----
  router.get('/assets/:id', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.view')) {
          return res.status(403).json({ error: 'Permission assets.view requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.view')) {
        return res.status(403).json({ error: 'Permission assets.view requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `
            SELECT a.*, u.name as assigned_to_name
            FROM assets a
            LEFT JOIN users u ON a.assigned_to = u.id
            WHERE a.id = ?
          `,
          args: [req.params.id]
        })
        const asset = result.rows[0]
        if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })
        return res.json(asset)
      } catch (err) {
        console.error('Erreur Turso GET asset:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const asset = db.prepare(`
      SELECT a.*, u.name as assigned_to_name
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE a.id = ?
    `).get(req.params.id)

    if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })
    res.json(asset)
  })

  // ---- POST /api/admin/assets ----
  router.post('/assets', async (req, res) => {
    const { type, name, category, brand, model, serial_number, location, assigned_to, status, purchase_date, warranty_end, editor, version, license_key, license_expires_at, license_count, notes } = req.body
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.create')) {
          return res.status(403).json({ error: 'Permission assets.create requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.create')) {
        return res.status(403).json({ error: 'Permission assets.create requise' })
      }
    }

    if (!type || !['hardware', 'software'].includes(type)) return res.status(400).json({ error: 'Le type doit être "hardware" ou "software"' })
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO assets (type, name, category, brand, model, serial_number, location, assigned_to, status, purchase_date, warranty_end, editor, version, license_key, license_expires_at, license_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [type, name.trim(), category || null, brand || null, model || null, serial_number || null, location || null, assigned_to || null, status || (type === 'hardware' ? 'En service' : 'Active'), purchase_date || null, warranty_end || null, editor || null, version || null, license_key || null, license_expires_at || null, license_count || null, notes || null]
        })
        const newId = Number(result.lastInsertRowid)
                await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'asset', newId, `${type === 'hardware' ? 'Hardware' : 'Software'} créé : ${name}`)
        return res.status(201).json(newAsset.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST asset:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const result = db.prepare(`
      INSERT INTO assets (type, name, category, brand, model, serial_number, location, assigned_to, status, purchase_date, warranty_end, editor, version, license_key, license_expires_at, license_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, name.trim(), category || null, brand || null, model || null, serial_number || null, location || null, assigned_to || null, status || (type === 'hardware' ? 'En service' : 'Active'), purchase_date || null, warranty_end || null, editor || null, version || null, license_key || null, license_expires_at || null, license_count || null, notes || null)

    const newAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'asset', newAsset.id, `${type === 'hardware' ? 'Hardware' : 'Software'} créé : ${newAsset.name}`)
    res.status(201).json(newAsset)
  })

  // ---- PATCH /api/admin/assets/:id ----
  router.patch('/assets/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.edit')) {
          return res.status(403).json({ error: 'Permission assets.edit requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.edit')) {
        return res.status(403).json({ error: 'Permission assets.edit requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM assets WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

        const allowedFields = ['name', 'category', 'brand', 'model', 'serial_number', 'location', 'assigned_to', 'status', 'purchase_date', 'warranty_end', 'editor', 'version', 'license_key', 'license_expires_at', 'license_count', 'notes']
        const updates = []
        const args = []

        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            args.push(req.body[field] === '' ? null : req.body[field])
          }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        args.push(targetId)

        await tursoDb.execute({ sql: `UPDATE assets SET ${updates.join(', ')} WHERE id = ?`, args })
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM assets WHERE id = ?', args: [targetId] })
                await logActionTurso(tursoDb, req.user.id, req.user.name, 'update', 'asset', targetId, `${updated.rows[0].type === 'hardware' ? 'Hardware' : 'Software'} modifié : ${updated.rows[0].name}`)
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso PATCH asset:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

    const allowedFields = ['name', 'category', 'brand', 'model', 'serial_number', 'location', 'assigned_to', 'status', 'purchase_date', 'warranty_end', 'editor', 'version', 'license_key', 'license_expires_at', 'license_count', 'notes']
    const updates = []
    const values = []

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(req.body[field] === '' ? null : req.body[field])
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    values.push(targetId)

    db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'asset', targetId, `${updated.type === 'hardware' ? 'Hardware' : 'Software'} modifié : ${updated.name}`)
    res.json(updated)
  })

  // ---- DELETE /api/admin/assets/:id ----
  router.delete('/assets/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.delete')) {
          return res.status(403).json({ error: 'Permission assets.delete requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.delete')) {
        return res.status(403).json({ error: 'Permission assets.delete requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM assets WHERE id = ?', args: [targetId] })
        const target = check.rows[0]
        if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

        await tursoDb.execute({ sql: 'UPDATE tickets SET asset_id = NULL WHERE asset_id = ?', args: [targetId] })
        await tursoDb.execute({ sql: 'DELETE FROM assets WHERE id = ?', args: [targetId] })
                await logActionTurso(tursoDb, req.user.id, req.user.name, 'delete', 'asset', targetId, `${target.type === 'hardware' ? 'Hardware' : 'Software'} supprimé : ${target.name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE asset:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const target = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

    db.prepare('UPDATE tickets SET asset_id = NULL WHERE asset_id = ?').run(targetId)
    db.prepare('DELETE FROM assets WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'asset', targetId, `${target.type === 'hardware' ? 'Hardware' : 'Software'} supprimé : ${target.name}`)
    res.json({ success: true })
  })

  // ==================== LOGS ====================

  // ---- GET /api/admin/logs ----
  router.get('/logs', async (req, res) => {
    const { entity, action, user_id, date_from, date_to, reviewed, limit = 100, offset = 0 } = req.query
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'logs.view')) {
          return res.status(403).json({ error: 'Permission logs.view requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'logs.view')) {
        return res.status(403).json({ error: 'Permission logs.view requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT l.*, u.email as user_email
          FROM logs l
          LEFT JOIN users u ON l.user_id = u.id
          WHERE 1=1
        `
        const args = []
        if (entity) { query += ' AND l.entity = ?'; args.push(entity) }
        if (action) { query += ' AND l.action = ?'; args.push(action) }
        if (user_id) { query += ' AND l.user_id = ?'; args.push(user_id) }
        if (date_from) { query += ' AND l.created_at >= ?'; args.push(date_from) }
        if (date_to) { query += ' AND l.created_at <= ?'; args.push(date_to) }
        if (reviewed === 'true') query += ' AND l.reviewed = 1'
        else if (reviewed === 'false') query += ' AND l.reviewed = 0'

        const countQuery = query.replace('SELECT l.*, u.email as user_email', 'SELECT COUNT(*) as c')
        const countResult = await tursoDb.execute({ sql: countQuery, args })
        const total = countResult.rows[0].c

        query += ' ORDER BY l.id DESC LIMIT ? OFFSET ?'
        args.push(parseInt(limit), parseInt(offset))

        const result = await tursoDb.execute({ sql: query, args })
        return res.json({ logs: result.rows, total })
      } catch (err) {
        console.error('Erreur Turso GET logs:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = `
      SELECT l.*, u.email as user_email
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `
    const params = []
    const countParams = []

    if (entity) { query += ' AND l.entity = ?'; params.push(entity); countParams.push(entity) }
    if (action) { query += ' AND l.action = ?'; params.push(action); countParams.push(action) }
    if (user_id) { query += ' AND l.user_id = ?'; params.push(user_id); countParams.push(user_id) }
    if (date_from) { query += ' AND l.created_at >= ?'; params.push(date_from); countParams.push(date_from) }
    if (date_to) { query += ' AND l.created_at <= ?'; params.push(date_to); countParams.push(date_to) }
    if (reviewed === 'true') query += ' AND l.reviewed = 1'
    else if (reviewed === 'false') query += ' AND l.reviewed = 0'

    let countQuery = 'SELECT COUNT(*) as c FROM logs l WHERE 1=1'
    if (entity) countQuery += ' AND l.entity = ?'
    if (action) countQuery += ' AND l.action = ?'
    if (user_id) countQuery += ' AND l.user_id = ?'
    if (date_from) countQuery += ' AND l.created_at >= ?'
    if (date_to) countQuery += ' AND l.created_at <= ?'
    if (reviewed === 'true') countQuery += ' AND l.reviewed = 1'
    else if (reviewed === 'false') countQuery += ' AND l.reviewed = 0'
    const total = db.prepare(countQuery).get(...countParams).c

    query += ' ORDER BY l.id DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const logs = db.prepare(query).all(...params)
    res.json({ logs, total })
  })

  // ==================== ARCHIVE ====================

  // ---- GET /api/admin/tickets/archived ----
  router.get('/tickets/archived', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.archive')) {
          return res.status(403).json({ error: 'Permission tickets.archive requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.archive')) {
        return res.status(403).json({ error: 'Permission tickets.archive requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT * FROM tickets WHERE archived = 1 ORDER BY archived_at DESC, id DESC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET archived:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const tickets = db.prepare(`
      SELECT * FROM tickets WHERE archived = 1 ORDER BY archived_at DESC, id DESC
    `).all()
    res.json(tickets)
  })

  // ---- POST /api/admin/tickets/:id/restore ----
  router.post('/tickets/:id/restore', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.archive')) {
          return res.status(403).json({ error: 'Permission tickets.archive requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.archive')) {
        return res.status(403).json({ error: 'Permission tickets.archive requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id, title FROM tickets WHERE id = ?', args: [targetId] })
        const ticket = check.rows[0]
        if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

               await tursoDb.execute({ sql: `UPDATE tickets SET archived = 0, archived_at = NULL WHERE id = ?`, args: [targetId] })
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'restore', 'ticket', targetId, `Ticket restauré : ${ticket.title}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso restore:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(targetId)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    db.prepare(`UPDATE tickets SET archived = 0, archived_at = NULL WHERE id = ?`).run(targetId)
    logAction(req.user.id, req.user.name, 'restore', 'ticket', targetId, `Ticket restauré : ${ticket.title}`)
    res.json({ success: true })
  })

  // ---- DELETE /api/admin/tickets/:id ----
  router.delete('/tickets/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'tickets.delete')) {
          return res.status(403).json({ error: 'Permission tickets.delete requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'tickets.delete')) {
        return res.status(403).json({ error: 'Permission tickets.delete requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id, title FROM tickets WHERE id = ?', args: [targetId] })
        const ticket = check.rows[0]
        if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

                await tursoDb.execute({ sql: 'DELETE FROM tickets WHERE id = ?', args: [targetId] })
        await logActionTurso(tursoDb, req.user.id, req.user.name, 'delete', 'ticket', targetId, `Ticket SUPPRIMÉ définitivement : ${ticket.title}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE ticket:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(targetId)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    db.prepare('DELETE FROM tickets WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'ticket', targetId, `Ticket SUPPRIMÉ définitivement : ${ticket.title}`)
    res.json({ success: true })
  })
  // ==================== FICHIERS DES ASSETS ====================

  // Config multer : stockage en mémoire (BLOB), limite 5 MB
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ]
      if (allowed.includes(file.mimetype)) cb(null, true)
      else cb(new Error('Type de fichier non autorisé (PDF, JPG, PNG, DOCX, XLSX, CSV uniquement)'))
    },
  })

  // ---- GET /api/admin/assets/:id/files ----
  router.get('/assets/:id/files', async (req, res) => {
    const assetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.download_file')) {
          return res.status(403).json({ error: 'Permission assets.download_file requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.download_file')) {
        return res.status(403).json({ error: 'Permission assets.download_file requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `SELECT id, asset_id, filename, mimetype, size, uploaded_by, uploaded_at FROM asset_files WHERE asset_id = ? ORDER BY id DESC`,
          args: [assetId]
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET asset files:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const files = db.prepare(`
      SELECT id, asset_id, filename, mimetype, size, uploaded_by, uploaded_at
      FROM asset_files WHERE asset_id = ? ORDER BY id DESC
    `).all(assetId)
    res.json(files)
  })

  // ---- POST /api/admin/assets/:id/files ----
  router.post('/assets/:id/files', upload.single('file'), async (req, res) => {
    const assetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.upload_file')) {
          return res.status(403).json({ error: 'Permission assets.upload_file requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.upload_file')) {
        return res.status(403).json({ error: 'Permission assets.upload_file requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id, name FROM assets WHERE id = ?', args: [assetId] })
        const asset = check.rows[0]
        if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO asset_files (asset_id, filename, mimetype, size, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [assetId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user.id]
        })

                await logActionTurso(tursoDb, req.user.id, req.user.name, 'upload', 'asset', assetId, `Fichier ajouté à "${asset.name}" : ${req.file.originalname}`)
        return res.status(201).json({ id: Number(result.lastInsertRowid) })
      } catch (err) {
        console.error('Erreur Turso POST asset file:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const asset = db.prepare('SELECT id, name FROM assets WHERE id = ?').get(assetId)
    if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })

    const result = db.prepare(`
      INSERT INTO asset_files (asset_id, filename, mimetype, size, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)
    `).run(assetId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user.id)

    logAction(req.user.id, req.user.name, 'upload', 'asset', assetId, `Fichier ajouté à "${asset.name}" : ${req.file.originalname}`)
    const newFile = db.prepare(`SELECT id, asset_id, filename, mimetype, size, uploaded_by, uploaded_at FROM asset_files WHERE id = ?`).get(result.lastInsertRowid)
    res.status(201).json(newFile)
  })

  // ---- GET /api/admin/assets/files/:fileId/download ----
  router.get('/assets/files/:fileId/download', async (req, res, next) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`
    }
    next()
  }, authRequired, adminOnly, async (req, res) => {
    const { tenantId } = req.user
    const fileId = parseInt(req.params.fileId)

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.download_file')) {
          return res.status(403).json({ error: 'Permission assets.download_file requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.download_file')) {
        return res.status(403).json({ error: 'Permission assets.download_file requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({ sql: 'SELECT * FROM asset_files WHERE id = ?', args: [fileId] })
        const file = result.rows[0]
        if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

        res.setHeader('Content-Type', file.mimetype)
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
        return res.send(file.data)
      } catch (err) {
        console.error('Erreur Turso download asset file:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const file = db.prepare('SELECT * FROM asset_files WHERE id = ?').get(fileId)
    if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.data)
  })

  // ==================== IMPORT CSV ====================

  router.post('/assets/import-csv', upload.single('file'), async (req, res) => {
    const { tenantId } = req.user

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier CSV reçu' })

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'assets.import')) {
          return res.status(403).json({ error: 'Permission assets.import requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'assets.import')) {
        return res.status(403).json({ error: 'Permission assets.import requise' })
      }
    }

    try {
      const content = req.file.buffer.toString('utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      if (lines.length < 2) return res.status(400).json({ error: 'Le fichier CSV est vide ou invalide' })

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const requiredHeaders = ['type', 'name']
      const missing = requiredHeaders.filter(h => !headers.includes(h))
      if (missing.length > 0) return res.status(400).json({ error: `Colonnes obligatoires manquantes : ${missing.join(', ')}` })

      const inserted = []
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || null })

        if (!row.type || !['hardware', 'software'].includes(row.type.toLowerCase())) {
          errors.push(`Ligne ${i + 1} : type invalide (doit être "hardware" ou "software")`)
          continue
        }
        if (!row.name) {
          errors.push(`Ligne ${i + 1} : nom manquant`)
          continue
        }

        let assignedToId = null
        if (row.assigned_to_email) {
          if (tenantId) {
            const tenant = TENANTS[tenantId]
            const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
            const u = await tursoDb.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [row.assigned_to_email] })
            if (u.rows.length > 0) assignedToId = u.rows[0].id
          } else {
            const u = db.prepare('SELECT id FROM users WHERE email = ?').get(row.assigned_to_email)
            if (u) assignedToId = u.id
          }
        }

        try {
          if (tenantId) {
            const tenant = TENANTS[tenantId]
            const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
            const result = await tursoDb.execute({
              sql: `INSERT INTO assets (type, name, category, brand, model, serial_number, location, assigned_to, status, purchase_date, warranty_end, editor, version, license_key, license_expires_at, license_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [row.type.toLowerCase(), row.name, row.category || null, row.brand || null, row.model || null, row.serial_number || null, row.location || null, assignedToId, row.status || (row.type.toLowerCase() === 'hardware' ? 'En service' : 'Active'), row.purchase_date || null, row.warranty_end || null, row.editor || null, row.version || null, row.license_key || null, row.license_expires_at || null, row.license_count ? parseInt(row.license_count) : null, row.notes || null]
            })
            inserted.push({ id: Number(result.lastInsertRowid), name: row.name, type: row.type.toLowerCase() })
          } else {
            const result = db.prepare(`
              INSERT INTO assets (type, name, category, brand, model, serial_number, location, assigned_to, status, purchase_date, warranty_end, editor, version, license_key, license_expires_at, license_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(row.type.toLowerCase(), row.name, row.category || null, row.brand || null, row.model || null, row.serial_number || null, row.location || null, assignedToId, row.status || (row.type.toLowerCase() === 'hardware' ? 'En service' : 'Active'), row.purchase_date || null, row.warranty_end || null, row.editor || null, row.version || null, row.license_key || null, row.license_expires_at || null, row.license_count ? parseInt(row.license_count) : null, row.notes || null)
            inserted.push({ id: result.lastInsertRowid, name: row.name, type: row.type.toLowerCase() })
          }
        } catch (err) {
          errors.push(`Ligne ${i + 1} : ${err.message}`)
        }
      }

           await logActionTurso(tursoDb, req.user.id, req.user.name, 'import', 'asset', null, `Import CSV : ${inserted.length} asset(s) créé(s), ${errors.length} erreur(s)`)
      res.json({ success: true, inserted: inserted.length, errors: errors.length, details: inserted, errorMessages: errors })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Erreur lors du traitement du CSV : ' + err.message })
    }
  })

  // ==================== EXPORT CSV DES LOGS ====================

  router.get('/logs/export', async (req, res) => {
    const { entity, action, user_id, date_from, date_to } = req.query
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'logs.export')) {
          return res.status(403).json({ error: 'Permission logs.export requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'logs.export')) {
        return res.status(403).json({ error: 'Permission logs.export requise' })
      }
    }

    let logs = []

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `SELECT l.*, u.email as user_email FROM logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`
        const args = []
        if (entity) { query += ' AND l.entity = ?'; args.push(entity) }
        if (action) { query += ' AND l.action = ?'; args.push(action) }
        if (user_id) { query += ' AND l.user_id = ?'; args.push(user_id) }
        if (date_from) { query += ' AND l.created_at >= ?'; args.push(date_from) }
        if (date_to) { query += ' AND l.created_at <= ?'; args.push(date_to) }
        query += ' ORDER BY l.id DESC'

        const result = await tursoDb.execute({ sql: query, args })
        logs = result.rows
      } catch (err) {
        console.error('Erreur Turso GET logs export:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    } else {
      // --- MODE SQLITE ---
      let query = `SELECT l.*, u.email as user_email FROM logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`
      const params = []
      if (entity) { query += ' AND l.entity = ?'; params.push(entity) }
      if (action) { query += ' AND l.action = ?'; params.push(action) }
      if (user_id) { query += ' AND l.user_id = ?'; params.push(user_id) }
      if (date_from) { query += ' AND l.created_at >= ?'; params.push(date_from) }
      if (date_to) { query += ' AND l.created_at <= ?'; params.push(date_to) }
      query += ' ORDER BY l.id DESC'
      logs = db.prepare(query).all(...params)
    }

    // Générer le CSV
    const headers = ['Date', 'Utilisateur', 'Email', 'Action', 'Entité', 'ID Entité', 'Détails']
    const csvEscape = (val) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
      return str
    }

    const rows = logs.map(l => [l.created_at, l.user_name || 'Système', l.user_email || '', l.action, l.entity, l.entity_id || '', l.details || ''].map(csvEscape).join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-')
    const filename = `logs-healthticket-${dateStr}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('\uFEFF' + csv)
  })

  // ==================== PERMISSIONS ====================

  // ---- GET /api/admin/permissions ----
  router.get('/permissions', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'permissions.list')) {
          return res.status(403).json({ error: 'Permission permissions.list requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'permissions.list')) {
        return res.status(403).json({ error: 'Permission permissions.list requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute('SELECT * FROM permissions ORDER BY module, code')
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET permissions:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, code').all()
    res.json(permissions)
  })

  // ---- GET /api/admin/users-permissions ----
  router.get('/users-permissions', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.manage_permissions')) {
          return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.manage_permissions')) {
        return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const usersResult = await tursoDb.execute(`SELECT id, name, email, role, custom_role, active FROM users ORDER BY id ASC`)
        const users = usersResult.rows

        const result = []
        for (const user of users) {
          let perms = []
          if (user.role === 'admin') {
            const pResult = await tursoDb.execute('SELECT code FROM permissions')
            perms = pResult.rows.map(p => p.code)
          } else {
            if (user.custom_role) {
              const rolePerms = await tursoDb.execute({
                sql: `SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?`,
                args: [user.custom_role]
              })
              perms.push(...rolePerms.rows.map(p => p.code))
            }
            const userPerms = await tursoDb.execute({
              sql: 'SELECT permission_code as code FROM user_permissions WHERE user_id = ?',
              args: [user.id]
            })
            perms.push(...userPerms.rows.map(p => p.code))
            perms = [...new Set(perms)]
          }
          result.push({ ...user, permissions: perms, isAdmin: user.role === 'admin' })
        }
        return res.json(result)
      } catch (err) {
        console.error('Erreur Turso GET users-permissions:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const users = db.prepare(`SELECT id, name, email, role, custom_role, active FROM users ORDER BY id ASC`).all()
    const result = users.map(user => {
      let perms = []
      if (user.role === 'admin') {
        perms = db.prepare('SELECT code FROM permissions').all().map(p => p.code)
      } else {
        if (user.custom_role) {
          const rolePerms = db.prepare(`
            SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?
          `).all(user.custom_role).map(p => p.code)
          perms.push(...rolePerms)
        }
        const userPerms = db.prepare('SELECT permission_code as code FROM user_permissions WHERE user_id = ?').all(user.id).map(p => p.code)
        perms.push(...userPerms)
        perms = [...new Set(perms)]
      }
      return { ...user, permissions: perms, isAdmin: user.role === 'admin' }
    })
    res.json(result)
  })

  // ---- POST /api/admin/roles/:id/permissions ----
  router.post('/roles/:id/permissions', async (req, res) => {
    const { permission_code } = req.body
    const roleId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (!permission_code) return res.status(400).json({ error: 'permission_code obligatoire' })

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'roles.manage_permissions')) {
          return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'roles.manage_permissions')) {
        return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: 'INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)',
          args: [roleId, permission_code]
        })
        return res.json({ success: true })
      } catch (err) {
        console.error('[TURSO] Erreur:', err.message)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    try {
      db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)').run(roleId, permission_code)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ---- POST /api/admin/users/:id/permissions ----
  router.post('/users/:id/permissions', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { permission_code } = req.body
    const { tenantId } = req.user

    if (!permission_code) return res.status(400).json({ error: 'permission_code obligatoire' })

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.manage_permissions')) {
          return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.manage_permissions')) {
        return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: 'INSERT OR IGNORE INTO user_permissions (user_id, permission_code, granted_by_id, granted_by_name) VALUES (?, ?, ?, ?)',
          args: [targetId, permission_code, req.user.id, req.user.name]
        })
        return res.status(201).json({ success: true })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // --- MODE SQLITE ---
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId)
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    if (user.role === 'admin') return res.status(400).json({ error: 'Les admins ont déjà toutes les permissions' })

    try {
      db.prepare(`INSERT OR IGNORE INTO user_permissions (user_id, permission_code, granted_by_id, granted_by_name) VALUES (?, ?, ?, ?)`).run(targetId, permission_code, req.user.id, req.user.name)
      res.status(201).json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ---- DELETE /api/admin/users/:id/permissions/:code ----
  router.delete('/users/:id/permissions/:code', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const permissionCode = req.params.code
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'users.manage_permissions')) {
          return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'users.manage_permissions')) {
        return res.status(403).json({ error: 'Permission users.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: 'DELETE FROM user_permissions WHERE user_id = ? AND permission_code = ?',
          args: [targetId, permissionCode]
        })
        return res.json({ success: true })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // --- MODE SQLITE ---
    try {
      db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission_code = ?').run(targetId, permissionCode)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ==================== REVUE DES LOGS (NIST) ====================

  router.post('/logs/:id/review', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'logs.review')) {
          return res.status(403).json({ error: 'Permission logs.review requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'logs.review')) {
        return res.status(403).json({ error: 'Permission logs.review requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM logs WHERE id = ?', args: [targetId] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Log non trouvé' })

        await tursoDb.execute({
          sql: `UPDATE logs SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?`,
          args: [req.user.name, targetId]
        })
        return res.json({ success: true })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // --- MODE SQLITE ---
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(targetId)
    if (!log) return res.status(404).json({ error: 'Log non trouvé' })

    db.prepare(`UPDATE logs SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ?`).run(req.user.name, targetId)
    logAction(req.user.id, req.user.name, 'review', 'log', targetId, `Log #${targetId} marqué comme revu`)
    res.json({ success: true })
  })

  router.post('/logs/bulk-review', async (req, res) => {
    const { log_ids } = req.body
    const { tenantId } = req.user

    if (!Array.isArray(log_ids) || log_ids.length === 0) {
      return res.status(400).json({ error: 'log_ids doit être un tableau non vide' })
    }

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'logs.bulk_review')) {
          return res.status(403).json({ error: 'Permission logs.bulk_review requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'logs.bulk_review')) {
        return res.status(403).json({ error: 'Permission logs.bulk_review requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        for (const id of log_ids) {
          await tursoDb.execute({
            sql: `UPDATE logs SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ? AND reviewed = 0`,
            args: [req.user.name, id]
          })
        }
        return res.json({ success: true, count: log_ids.length })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // --- MODE SQLITE ---
    const stmt = db.prepare(`UPDATE logs SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime') WHERE id = ? AND reviewed = 0`)
    let count = 0
    for (const id of log_ids) {
      const result = stmt.run(req.user.name, id)
      count += result.changes
    }
    logAction(req.user.id, req.user.name, 'bulk-review', 'log', null, `${count} log(s) marqué(s) comme revu(s)`)
    res.json({ success: true, count })
  })

  // ---- GET /api/admin/logs/review-stats ----
  router.get('/logs/review-stats', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'logs.review_stats')) {
          return res.status(403).json({ error: 'Permission logs.review_stats requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'logs.review_stats')) {
        return res.status(403).json({ error: 'Permission logs.review_stats requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const totalResult = await tursoDb.execute('SELECT COUNT(*) as c FROM logs')
        const reviewedResult = await tursoDb.execute('SELECT COUNT(*) as c FROM logs WHERE reviewed = 1')
        const total = totalResult.rows[0].c
        const reviewed = reviewedResult.rows[0].c

        const oldestResult = await tursoDb.execute(`SELECT id, created_at, action, entity, details, user_name FROM logs WHERE reviewed = 0 ORDER BY created_at ASC LIMIT 5`)
        const lastReviewResult = await tursoDb.execute(`SELECT reviewed_by, reviewed_at FROM logs WHERE reviewed = 1 ORDER BY reviewed_at DESC LIMIT 1`)
        const byDayResult = await tursoDb.execute(`
          SELECT DATE(created_at) as day, COUNT(*) as count FROM logs WHERE reviewed = 0 AND created_at >= datetime('now', '-7 days', 'localtime') GROUP BY DATE(created_at) ORDER BY day DESC
        `)

        return res.json({
          total,
          reviewed,
          unreviewed: total - reviewed,
          review_rate: total > 0 ? Math.round((reviewed / total) * 100) : 0,
          oldest_unreviewed: oldestResult.rows,
          last_review: lastReviewResult.rows[0] || null,
          unreviewed_by_day: byDayResult.rows,
        })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }
    }

    // --- MODE SQLITE ---
    const total = db.prepare('SELECT COUNT(*) as c FROM logs').get().c
    const reviewed = db.prepare('SELECT COUNT(*) as c FROM logs WHERE reviewed = 1').get().c
    const oldestUnreviewed = db.prepare(`SELECT id, created_at, action, entity, details, user_name FROM logs WHERE reviewed = 0 ORDER BY created_at ASC LIMIT 5`).all()
    const lastReview = db.prepare(`SELECT reviewed_by, reviewed_at FROM logs WHERE reviewed = 1 ORDER BY reviewed_at DESC LIMIT 1`).get()
    const byDay = db.prepare(`SELECT DATE(created_at) as day, COUNT(*) as count FROM logs WHERE reviewed = 0 AND created_at >= datetime('now', '-7 days', 'localtime') GROUP BY DATE(created_at) ORDER BY day DESC`).all()

    res.json({
      total, reviewed, unreviewed: total - reviewed,
      review_rate: total > 0 ? Math.round((reviewed / total) * 100) : 0,
      oldest_unreviewed: oldestUnreviewed,
      last_review: lastReview,
      unreviewed_by_day: byDay,
    })
  })

  // ==================== RÔLES DYNAMIQUES ====================

  // GET /api/admin/roles
  router.get('/roles', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'roles.list')) {
          return res.status(403).json({ error: 'Permission roles.list requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'roles.list')) {
        return res.status(403).json({ error: 'Permission roles.list requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute(`
          SELECT r.*, 
          (SELECT COUNT(*) FROM users u WHERE u.custom_role = r.name) as user_count,
          (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
          FROM roles r ORDER BY r.name ASC
        `)
        return res.json(result.rows)
      } catch (err) {
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const roles = db.prepare(`
      SELECT r.*, 
      (SELECT COUNT(*) FROM users u WHERE u.custom_role = r.name) as user_count,
      (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
      FROM roles r ORDER BY r.name ASC
    `).all()
    res.json(roles)
  })

  // POST /api/admin/roles
  router.post('/roles', async (req, res) => {
    const { name, description } = req.body
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'roles.create')) {
          return res.status(403).json({ error: 'Permission roles.create requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'roles.create')) {
        return res.status(403).json({ error: 'Permission roles.create requise' })
      }
    }

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({
          sql: 'INSERT INTO roles (name, description) VALUES (?, ?)',
          args: [name.trim(), description || null]
        })

	        await logActionTurso(tursoDb, req.user.id, req.user.name, 'create', 'role', Number(result.lastInsertRowid), `Rôle créé : ${name.trim()}`)
        return res.status(201).json({ success: true, id: Number(result.lastInsertRowid) })
        
      } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce rôle existe déjà' })
        return res.status(500).json({ error: err.message })
      }
    }

    try {
      const result = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name.trim(), description || null)
      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce rôle existe déjà' })
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/admin/roles/:id/permissions
  router.get('/roles/:id/permissions', async (req, res) => {
    const { tenantId } = req.user

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'roles.manage_permissions')) {
          return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'roles.manage_permissions')) {
        return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({
          sql: 'SELECT permission_code FROM role_permissions WHERE role_id = ? ORDER BY permission_code ASC',
          args: [req.params.id]
        })
        return res.json(result.rows.map(p => p.permission_code))
      } catch (err) {
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const perms = db.prepare('SELECT permission_code FROM role_permissions WHERE role_id = ? ORDER BY permission_code ASC').all(req.params.id)
    res.json(perms.map(p => p.permission_code))
  })

  // DELETE /api/admin/roles/:id/permissions/:code
  router.delete('/roles/:id/permissions/:code', async (req, res) => {
    const { tenantId } = req.user
    const roleId = req.params.id
    const permissionCode = req.params.code

    // Vérification de permission
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (tenant) {
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'roles.manage_permissions')) {
          return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
        }
      }
    } else {
      if (!userHasPermission(db, req.user.id, req.user.role, 'roles.manage_permissions')) {
        return res.status(403).json({ error: 'Permission roles.manage_permissions requise' })
      }
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        await tursoDb.execute({
          sql: 'DELETE FROM role_permissions WHERE role_id = ? AND permission_code = ?',
          args: [roleId, permissionCode]
        })
        return res.json({ success: true })
      } catch (err) {
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    try {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_code = ?').run(roleId, permissionCode)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
