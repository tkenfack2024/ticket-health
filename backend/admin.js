import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authRequired, adminOnly } from './auth.js'
import multer from 'multer'
// ✅ AJOUT DES IMPORTS TURSO
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

export function createAdminRouter(db, logAction) {
  const router = Router()

  // Toutes les routes admin nécessitent auth + rôle admin
  router.use(authRequired, adminOnly)

  // Migration : colonnes de revue des logs
  const logColumns = db.prepare('PRAGMA table_info(logs)').all().map(c => c.name)
  if (!logColumns.includes('reviewed')) {
    db.exec('ALTER TABLE logs ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0')
    console.log('🔧 Migration : colonne reviewed ajoutée à logs')
  }
  if (!logColumns.includes('reviewed_by')) {
    db.exec('ALTER TABLE logs ADD COLUMN reviewed_by TEXT')
    console.log('🔧 Migration : colonne reviewed_by ajoutée à logs')
  }
  if (!logColumns.includes('reviewed_at')) {
    db.exec('ALTER TABLE logs ADD COLUMN reviewed_at TEXT')
    console.log('🔧 Migration : colonne reviewed_at ajoutée à logs')
  }

    // ---- GET /api/admin/users ----
  // Liste tous les utilisateurs (Turso ou SQLite)
  router.get('/users', async (req, res) => {
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT id, name, email, phone, role, custom_role, active, created_at
          FROM users
          ORDER BY id DESC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET users:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const users = db.prepare(`
      SELECT id, name, email, phone, role, custom_role, active, created_at
      FROM users
      ORDER BY id DESC
    `).all()
    res.json(users)
  })

   // ---- POST /api/admin/users ----
  // Créer un nouvel utilisateur
  router.post('/users', async (req, res) => {
    const { name, email, phone, password, role, custom_role } = req.body
    const { tenantId } = req.user // <-- On récupère le tenantId du token

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

    // --- MODE TURSO (Multi-tenant) ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        // Vérifier que le custom_role existe si fourni
        if (custom_role) {
          const roleExists = await tursoDb.execute({ 
            sql: 'SELECT id FROM roles WHERE name = ?', 
            args: [custom_role] 
          })
          if (roleExists.rows.length === 0) {
            return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
          }
        }

        const existing = await tursoDb.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [email.toLowerCase().trim()]
        })
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Cet email est déjà utilisé' })
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO users (name, email, phone, password_hash, role, custom_role) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [name.trim(), email.toLowerCase().trim(), phone || null, hash, role || 'user', custom_role || null]
        })

        const newUserId = Number(result.lastInsertRowid)
        const newUserResult = await tursoDb.execute({
          sql: 'SELECT id, name, email, phone, role, custom_role, active, created_at FROM users WHERE id = ?',
          args: [newUserId]
        })
        const newUser = newUserResult.rows[0]

        logAction(req.user.id, req.user.name, 'create', 'user', newUserId, `Nouvel utilisateur : ${newUser.email} (${newUser.role}) [Turso]`)
        return res.status(201).json(newUser)

      } catch (err) {
        console.error('Erreur Turso POST user:', err)
        return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' })
      }
    }

    // --- MODE SQLITE (Si pas de tenantId) ---
    // Vérifier que le custom_role existe si fourni
    if (custom_role) {
      const roleExists = db.prepare('SELECT id FROM roles WHERE name = ?').get(custom_role)
      if (!roleExists) {
        return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
      }
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' })
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role, custom_role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), phone || null, hash, role || 'user', custom_role || null)

    const newUser = db.prepare(`
      SELECT id, name, email, phone, role, custom_role, active, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid)

    logAction(req.user.id, req.user.name, 'create', 'user', newUser.id, `Nouvel utilisateur : ${newUser.email} (${newUser.role}${newUser.custom_role ? ' / ' + newUser.custom_role : ''})`)

    res.status(201).json(newUser)
  })

    // ---- PATCH /api/admin/users/:id ----
  // Modifier un utilisateur (rôle, nom, téléphone, actif, custom_role)
  router.patch('/users/:id', (req, res) => {
    const { name, phone, role, custom_role, active } = req.body
    const targetId = parseInt(req.params.id)

    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    // Protection : ne peut pas se rétrograder soi-même
    if (targetId === req.user.id && role && role !== 'admin') {
      return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
    }

    if (role && !['admin', 'technicien', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rôle de base invalide' })
    }

    // Vérifier custom_role si fourni
    if (custom_role && custom_role !== null) {
      const roleExists = db.prepare('SELECT id FROM roles WHERE name = ?').get(custom_role)
      if (!roleExists) {
        return res.status(400).json({ error: 'Ce rôle personnalisé n\'existe pas' })
      }
    }

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          custom_role = CASE WHEN ? = '__CLEAR__' THEN NULL ELSE COALESCE(?, custom_role) END,
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name || null,
      phone !== undefined ? phone : null,
      role || null,
      custom_role === null ? '__CLEAR__' : 'NO_CHANGE',
      custom_role || null,
      active !== undefined ? (active ? 1 : 0) : null,
      targetId
    )

    const updated = db.prepare(`
      SELECT id, name, email, phone, role, custom_role, active, created_at
      FROM users WHERE id = ?
    `).get(targetId)

    logAction(req.user.id, req.user.name, 'update', 'user', targetId, `Utilisateur modifié : ${updated.email} (${updated.role}${updated.custom_role ? ' / ' + updated.custom_role : ''}, ${updated.active ? 'actif' : 'désactivé'})`)

    res.json(updated)
  })

  // ---- POST /api/admin/users/:id/reset-password ----
  // Réinitialiser le mot de passe d'un utilisateur
  router.post('/users/:id/reset-password', (req, res) => {
    const { newPassword } = req.body
    const targetId = parseInt(req.params.id)

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
    }

    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    const hash = bcrypt.hashSync(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetId)

    logAction(req.user.id, req.user.name, 'reset-password', 'user', targetId, `Mot de passe réinitialisé : ${target.email}`)

    res.json({ success: true })
  })

  // ---- DELETE /api/admin/users/:id ----
  // Désactiver un utilisateur (soft delete)
  router.delete('/users/:id', (req, res) => {
    const targetId = parseInt(req.params.id)

    // Empêcher de se désactiver soi-même
    if (targetId === req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    }

    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'deactivate', 'user', targetId, `Utilisateur désactivé : ${target.email}`)

    res.json({ success: true })
  })

  // ==================== MODULES ====================

  // ---- GET /api/admin/modules ----
  router.get('/modules', (req, res) => {
    const modules = db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM tickets WHERE module_id = m.id OR category = m.name) as ticket_count
      FROM modules m
      ORDER BY m.id ASC
    `).all()
    res.json(modules)
  })

  // ---- POST /api/admin/modules ----
  router.post('/modules', (req, res) => {
    const { name, description, icon, color } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }

    const existing = db.prepare('SELECT id FROM modules WHERE LOWER(name) = ?').get(name.toLowerCase().trim())
    if (existing) {
      return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })
    }

    const result = db.prepare(`
      INSERT INTO modules (name, description, icon, color)
      VALUES (?, ?, ?, ?)
    `).run(
      name.trim(),
      description?.trim() || null,
      icon || 'Box',
      color || 'slate'
    )

    const newModule = db.prepare('SELECT * FROM modules WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'module', newModule.id, `Module créé : ${newModule.name}`)

    res.status(201).json(newModule)
  })

  // ---- PATCH /api/admin/modules/:id ----
  router.patch('/modules/:id', (req, res) => {
    const { name, description, icon, color, active } = req.body
    const targetId = parseInt(req.params.id)

    const target = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Module non trouvé' })

    // Vérifier unicité du nom si on le change
    if (name && name.toLowerCase().trim() !== target.name.toLowerCase()) {
      const existing = db.prepare('SELECT id FROM modules WHERE LOWER(name) = ? AND id != ?')
        .get(name.toLowerCase().trim(), targetId)
      if (existing) {
        return res.status(409).json({ error: 'Un module avec ce nom existe déjà' })
      }
    }

    db.prepare(`
      UPDATE modules
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          icon = COALESCE(?, icon),
          color = COALESCE(?, color),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name?.trim() || null,
      description !== undefined ? description : null,
      icon || null,
      color || null,
      active !== undefined ? (active ? 1 : 0) : null,
      targetId
    )

    const updated = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'module', targetId, `Module modifié : ${updated.name}`)

    res.json(updated)
  })

  // ---- DELETE /api/admin/modules/:id ----
  router.delete('/modules/:id', (req, res) => {
    const targetId = parseInt(req.params.id)

    const target = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Module non trouvé' })

    // Compter les tickets liés
    const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE category = ?').get(target.name).c

    if (ticketCount > 0) {
      // Désactiver au lieu de supprimer si des tickets existent
      db.prepare('UPDATE modules SET active = 0 WHERE id = ?').run(targetId)
      logAction(req.user.id, req.user.name, 'deactivate', 'module', targetId,
        `Module désactivé (${ticketCount} tickets liés) : ${target.name}`)
      return res.json({ success: true, deactivated: true, ticketCount })
    }

    // Sinon, vraie suppression
    db.prepare('DELETE FROM modules WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'module', targetId, `Module supprimé : ${target.name}`)
    res.json({ success: true, deleted: true })
  })

  // ==================== ASSETS ====================

  // ---- GET /api/admin/assets ----
  // Liste des assets avec filtres
  router.get('/assets', (req, res) => {
    const { type, status, search } = req.query

    let query = `
      SELECT a.*, u.name as assigned_to_name
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE 1=1
    `
    const params = []

    if (type && ['hardware', 'software'].includes(type)) {
      query += ' AND a.type = ?'
      params.push(type)
    }
    if (status) {
      query += ' AND a.status = ?'
      params.push(status)
    }
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
  router.get('/assets/:id', (req, res) => {
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
  router.post('/assets', (req, res) => {
    const {
      type, name, category, brand, model, serial_number, location,
      assigned_to, status, purchase_date, warranty_end,
      editor, version, license_key, license_expires_at, license_count,
      notes,
    } = req.body

    if (!type || !['hardware', 'software'].includes(type)) {
      return res.status(400).json({ error: 'Le type doit être "hardware" ou "software"' })
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }

    const result = db.prepare(`
      INSERT INTO assets (
        type, name, category, brand, model, serial_number, location,
        assigned_to, status, purchase_date, warranty_end,
        editor, version, license_key, license_expires_at, license_count,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type,
      name.trim(),
      category || null,
      brand || null,
      model || null,
      serial_number || null,
      location || null,
      assigned_to || null,
      status || (type === 'hardware' ? 'En service' : 'Active'),
      purchase_date || null,
      warranty_end || null,
      editor || null,
      version || null,
      license_key || null,
      license_expires_at || null,
      license_count || null,
      notes || null
    )

    const newAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'asset', newAsset.id,
      `${type === 'hardware' ? 'Hardware' : 'Software'} créé : ${newAsset.name}`)

    res.status(201).json(newAsset)
  })

  // ---- PATCH /api/admin/assets/:id ----
  router.patch('/assets/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const target = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

    const allowedFields = [
      'name', 'category', 'brand', 'model', 'serial_number', 'location',
      'assigned_to', 'status', 'purchase_date', 'warranty_end',
      'editor', 'version', 'license_key', 'license_expires_at', 'license_count',
      'notes',
    ]

    const updates = []
    const values = []

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(req.body[field] === '' ? null : req.body[field])
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    }

    values.push(targetId)
    db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'asset', targetId,
      `${updated.type === 'hardware' ? 'Hardware' : 'Software'} modifié : ${updated.name}`)

    res.json(updated)
  })

  // ---- DELETE /api/admin/assets/:id ----
  router.delete('/assets/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const target = db.prepare('SELECT * FROM assets WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Asset non trouvé' })

    // Détacher les tickets liés
    db.prepare('UPDATE tickets SET asset_id = NULL WHERE asset_id = ?').run(targetId)

    db.prepare('DELETE FROM assets WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'asset', targetId,
      `${target.type === 'hardware' ? 'Hardware' : 'Software'} supprimé : ${target.name}`)

    res.json({ success: true })
  })
  // ==================== LOGS ====================

      router.get('/logs', (req, res) => {
    const { entity, action, user_id, date_from, date_to, reviewed, limit = 100, offset = 0 } = req.query

    let query = `
      SELECT l.*, u.email as user_email
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `
    const params = []
    const countParams = []

    if (entity) {
      query += ' AND l.entity = ?'
      params.push(entity)
      countParams.push(entity)
    }
    if (action) {
      query += ' AND l.action = ?'
      params.push(action)
      countParams.push(action)
    }
     if (date_from) {
      query += ' AND l.created_at >= ?'
      params.push(date_from)
      countParams.push(date_from)
    }
    if (date_to) {
      query += ' AND l.created_at <= ?'
      params.push(date_to)
      countParams.push(date_to)
    }
    if (reviewed === 'true') {
      query += ' AND l.reviewed = 1'
    } else if (reviewed === 'false') {
      query += ' AND l.reviewed = 0'
    }
    if (date_to) {
      query += ' AND l.created_at <= ?'
      params.push(date_to)
      countParams.push(date_to)
    }

    // Compter le total filtré
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

  router.get('/tickets/archived', (req, res) => {
    const tickets = db.prepare(`
      SELECT * FROM tickets
      WHERE archived = 1
      ORDER BY archived_at DESC, id DESC
    `).all()
    res.json(tickets)
  })

  router.post('/tickets/:id/restore', (req, res) => {
    const targetId = parseInt(req.params.id)
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(targetId)

    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    db.prepare(`
      UPDATE tickets SET archived = 0, archived_at = NULL WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'restore', 'ticket', targetId,
      `Ticket restauré : ${ticket.title}`)

    res.json({ success: true })
  })

  router.delete('/tickets/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(targetId)

    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    db.prepare('DELETE FROM tickets WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'delete', 'ticket', targetId,
      `Ticket SUPPRIMÉ définitivement : ${ticket.title}`)

    res.json({ success: true })
  })

  // ==================== FICHIERS DES ASSETS ====================

  // Config multer : stockage en mémoire (BLOB), limite 5 MB
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ]
      if (allowed.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Type de fichier non autorisé (PDF, JPG, PNG, DOCX, XLSX, CSV uniquement)'))
      }
    },
  })

  // ---- GET /api/admin/assets/:id/files ----
  // Liste les fichiers d'un asset (sans les données BLOB)
  router.get('/assets/:id/files', (req, res) => {
    const assetId = parseInt(req.params.id)
    const files = db.prepare(`
      SELECT id, asset_id, filename, mimetype, size, uploaded_by, uploaded_at
      FROM asset_files
      WHERE asset_id = ?
      ORDER BY id DESC
    `).all(assetId)
    res.json(files)
  })

  // ---- POST /api/admin/assets/:id/files ----
  // Upload un fichier
  router.post('/assets/:id/files', upload.single('file'), (req, res) => {
    const assetId = parseInt(req.params.id)

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu' })
    }

    // Vérifier que l'asset existe
    const asset = db.prepare('SELECT id, name FROM assets WHERE id = ?').get(assetId)
    if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })

    const result = db.prepare(`
      INSERT INTO asset_files (asset_id, filename, mimetype, size, data, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      assetId,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.buffer,
      req.user.id
    )

    logAction(req.user.id, req.user.name, 'upload', 'asset', assetId,
      `Fichier ajouté à "${asset.name}" : ${req.file.originalname}`)

    const newFile = db.prepare(`
      SELECT id, asset_id, filename, mimetype, size, uploaded_by, uploaded_at
      FROM asset_files WHERE id = ?
    `).get(result.lastInsertRowid)

    res.status(201).json(newFile)
  })

  // ---- GET /api/admin/assets/files/:fileId/download ----
  // Télécharger un fichier
  router.get('/assets/files/:fileId/download', (req, res, next) => {
    // Accepter le token en query string (pour les liens <a href>)
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`
    }
    next()
  }, authRequired, adminOnly, (req, res) => {
    const file = db.prepare('SELECT * FROM asset_files WHERE id = ?').get(req.params.fileId)
    if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.data)
  })

  // ==================== IMPORT CSV ====================

  router.post('/assets/import-csv', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier CSV reçu' })
    }

    try {
      const content = req.file.buffer.toString('utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        return res.status(400).json({ error: 'Le fichier CSV est vide ou invalide' })
      }

      // Header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const requiredHeaders = ['type', 'name']
      const missing = requiredHeaders.filter(h => !headers.includes(h))
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Colonnes obligatoires manquantes : ${missing.join(', ')}`
        })
      }

      const inserted = []
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx] || null
        })

        // Validation
        if (!row.type || !['hardware', 'software'].includes(row.type.toLowerCase())) {
          errors.push(`Ligne ${i + 1} : type invalide (doit être "hardware" ou "software")`)
          continue
        }
        if (!row.name) {
          errors.push(`Ligne ${i + 1} : nom manquant`)
          continue
        }

        // Vérifier si un user assigné existe
        let assignedToId = null
        if (row.assigned_to_email) {
          const u = db.prepare('SELECT id FROM users WHERE email = ?').get(row.assigned_to_email)
          if (u) assignedToId = u.id
        }

        try {
          const result = db.prepare(`
            INSERT INTO assets (
              type, name, category, brand, model, serial_number, location,
              assigned_to, status, purchase_date, warranty_end,
              editor, version, license_key, license_expires_at, license_count,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            row.type.toLowerCase(),
            row.name,
            row.category || null,
            row.brand || null,
            row.model || null,
            row.serial_number || null,
            row.location || null,
            assignedToId,
            row.status || (row.type.toLowerCase() === 'hardware' ? 'En service' : 'Active'),
            row.purchase_date || null,
            row.warranty_end || null,
            row.editor || null,
            row.version || null,
            row.license_key || null,
            row.license_expires_at || null,
            row.license_count ? parseInt(row.license_count) : null,
            row.notes || null
          )
          inserted.push({ id: result.lastInsertRowid, name: row.name, type: row.type.toLowerCase() })
        } catch (err) {
          errors.push(`Ligne ${i + 1} : ${err.message}`)
        }
      }

      logAction(req.user.id, req.user.name, 'import', 'asset', null,
        `Import CSV : ${inserted.length} asset(s) créé(s), ${errors.length} erreur(s)`)

      res.json({
        success: true,
        inserted: inserted.length,
        errors: errors.length,
        details: inserted,
        errorMessages: errors,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Erreur lors du traitement du CSV : ' + err.message })
    }
  })

  // ==================== EXPORT CSV DES LOGS ====================

  router.get('/logs/export', (req, res) => {
    const { entity, action, user_id, date_from, date_to } = req.query

    let query = `
      SELECT l.*, u.email as user_email
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `
    const params = []

    if (entity) {
      query += ' AND l.entity = ?'
      params.push(entity)
    }
    if (action) {
      query += ' AND l.action = ?'
      params.push(action)
    }
    if (user_id) {
      query += ' AND l.user_id = ?'
      params.push(user_id)
    }
    if (date_from) {
      query += ' AND l.created_at >= ?'
      params.push(date_from)
    }
    if (date_to) {
      query += ' AND l.created_at <= ?'
      params.push(date_to)
    }

    query += ' ORDER BY l.id DESC'

    const logs = db.prepare(query).all(...params)

    // Générer le CSV
    const headers = ['Date', 'Utilisateur', 'Email', 'Action', 'Entité', 'ID Entité', 'Détails']
    const csvEscape = (val) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      // Échapper les guillemets et entourer si contient , " ou \n
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = logs.map(l => [
      l.created_at,
      l.user_name || 'Système',
      l.user_email || '',
      l.action,
      l.entity,
      l.entity_id || '',
      l.details || '',
    ].map(csvEscape).join(','))

    const csv = [headers.join(','), ...rows].join('\n')

    // Nom du fichier avec date
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-')
    const filename = `logs-healthticket-${dateStr}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // BOM UTF-8 pour qu'Excel affiche bien les accents
    res.send('\uFEFF' + csv)
  })

  // ==================== PERMISSIONS ====================

  // ---- GET /api/admin/permissions ----
  // Liste toutes les permissions disponibles
  router.get('/permissions', (req, res) => {
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, code').all()
    res.json(permissions)
  })

  // ---- GET /api/admin/users-permissions ----
  // Liste tous les users avec leurs permissions
    router.get('/users-permissions', (req, res) => {
    const users = db.prepare(`
      SELECT id, name, email, role, custom_role, active FROM users ORDER BY id ASC
    `).all()

    const result = users.map(user => {
      let perms = []
      
      if (user.role === 'admin') {
        perms = db.prepare('SELECT code FROM permissions').all().map(p => p.code)
      } else {
        // 1. Permissions du custom_role
        if (user.custom_role) {
          const rolePerms = db.prepare(`
            SELECT rp.permission_code as code 
            FROM role_permissions rp 
            JOIN roles r ON rp.role_id = r.id 
            WHERE r.name = ?
          `).all(user.custom_role).map(p => p.code)
          perms.push(...rolePerms)
        }
        // 2. Permissions individuelles
        const userPerms = db.prepare('SELECT permission_code as code FROM user_permissions WHERE user_id = ?')
          .all(user.id).map(p => p.code)
        perms.push(...userPerms)
        // Dédoublonner
        perms = [...new Set(perms)]
      }

      return {
        ...user,
        permissions: perms,
        isAdmin: user.role === 'admin',
      }
    })

    res.json(result)
  })

  // POST /api/admin/permissions
  router.post('/permissions', (req, res) => {
    const { code, label, module, description } = req.body
    
    if (!code || !label || !module) {
      return res.status(400).json({ error: 'Code, label et module sont obligatoires' })
    }

    try {
      // On nettoie le code (minuscules, pas d'espaces)
      const cleanCode = code.trim().toLowerCase().replace(/\s+/g, '.')
      
      const result = db.prepare(`
        INSERT INTO permissions (code, label, module, description)
        VALUES (?, ?, ?, ?)
      `).run(cleanCode, label.trim(), module.trim().toLowerCase(), description || null)

      logAction(req.user.id, req.user.name, 'create', 'permission', result.lastInsertRowid, `Permission créée : ${cleanCode}`)
      res.status(201).json({ success: true, code: cleanCode })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce code de permission existe déjà' })
      res.status(500).json({ error: err.message })
    }
  })

  // ---- POST /api/admin/users/:id/permissions ----
  // Ajouter une permission à un user
  router.post('/users/:id/permissions', (req, res) => {
    const targetId = parseInt(req.params.id)
    const { permission_code } = req.body

    if (!permission_code) {
      return res.status(400).json({ error: 'permission_code obligatoire' })
    }

    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId)
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    // Les admins ont déjà tout
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Les admins ont déjà toutes les permissions' })
    }

    // Vérifier que la permission existe
    const perm = db.prepare('SELECT code FROM permissions WHERE code = ?').get(permission_code)
    if (!perm) return res.status(404).json({ error: 'Permission inexistante' })

    // Vérifier si déjà accordée
    const existing = db.prepare(`
      SELECT id FROM user_permissions WHERE user_id = ? AND permission_code = ?
    `).get(targetId, permission_code)

    if (existing) {
      return res.status(409).json({ error: 'Permission déjà accordée' })
    }

    db.prepare(`
      INSERT INTO user_permissions (user_id, permission_code, granted_by_id, granted_by_name)
      VALUES (?, ?, ?, ?)
    `).run(targetId, permission_code, req.user.id, req.user.name)

    logAction(req.user.id, req.user.name, 'grant', 'permission', targetId,
      `Permission "${permission_code}" accordée à ${user.name}`)

    res.status(201).json({ success: true })
  })

  // ---- DELETE /api/admin/users/:id/permissions/:code ----
  // Révoquer une permission
  router.delete('/users/:id/permissions/:code', (req, res) => {
    const targetId = parseInt(req.params.id)
    const permissionCode = req.params.code

    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId)
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Impossible de révoquer les permissions d\'un admin' })
    }

    const result = db.prepare(`
      DELETE FROM user_permissions WHERE user_id = ? AND permission_code = ?
    `).run(targetId, permissionCode)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Permission non trouvée pour cet utilisateur' })
    }

    logAction(req.user.id, req.user.name, 'revoke', 'permission', targetId,
      `Permission "${permissionCode}" révoquée à ${user.name}`)

    res.json({ success: true })
  })

  // ==================== REVUE DES LOGS ====================

  // ---- POST /api/admin/logs/:id/review ----
  // Marquer un log comme revu
  router.post('/logs/:id/review', (req, res) => {
    const targetId = parseInt(req.params.id)
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(targetId)
    if (!log) return res.status(404).json({ error: 'Log non trouvé' })

    db.prepare(`
      UPDATE logs
      SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.user.name, targetId)

    logAction(req.user.id, req.user.name, 'review', 'log', targetId, `Log #${targetId} marqué comme revu`)

    res.json({ success: true })
  })

  // ---- POST /api/admin/logs/bulk-review ----
  // Marquer plusieurs logs comme revus
  router.post('/logs/bulk-review', (req, res) => {
    const { log_ids } = req.body
    if (!Array.isArray(log_ids) || log_ids.length === 0) {
      return res.status(400).json({ error: 'log_ids doit être un tableau non vide' })
    }

    const stmt = db.prepare(`
      UPDATE logs
      SET reviewed = 1, reviewed_by = ?, reviewed_at = datetime('now', 'localtime')
      WHERE id = ? AND reviewed = 0
    `)

    let count = 0
    for (const id of log_ids) {
      const result = stmt.run(req.user.name, id)
      count += result.changes
    }

    logAction(req.user.id, req.user.name, 'bulk-review', 'log', null,
      `${count} log(s) marqué(s) comme revu(s)`)

    res.json({ success: true, count })
  })

  // ---- POST /api/admin/logs/:id/unreview ----
  // Retirer le statut "revu" (en cas d'erreur)
  router.post('/logs/:id/unreview', (req, res) => {
    const targetId = parseInt(req.params.id)
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(targetId)
    if (!log) return res.status(404).json({ error: 'Log non trouvé' })

    db.prepare(`
      UPDATE logs SET reviewed = 0, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?
    `).run(targetId)

    logAction(req.user.id, req.user.name, 'unreview', 'log', targetId, `Log #${targetId} démarqué`)

    res.json({ success: true })
  })

  // ---- GET /api/admin/logs/review-stats ----
  // Statistiques de revue
  router.get('/logs/review-stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM logs').get().c
    const reviewed = db.prepare('SELECT COUNT(*) as c FROM logs WHERE reviewed = 1').get().c
    const unreviewed = total - reviewed

    // Logs non revus par ancienneté (les plus vieux en premier)
    const oldestUnreviewed = db.prepare(`
      SELECT id, created_at, action, entity, details, user_name
      FROM logs
      WHERE reviewed = 0
      ORDER BY created_at ASC
      LIMIT 5
    `).all()

    // Dernier audit
    const lastReview = db.prepare(`
      SELECT reviewed_by, reviewed_at
      FROM logs
      WHERE reviewed = 1
      ORDER BY reviewed_at DESC
      LIMIT 1
    `).get()

    // Logs non revus par jour (7 derniers jours)
    const byDay = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM logs
      WHERE reviewed = 0
        AND created_at >= datetime('now', '-7 days', 'localtime')
      GROUP BY DATE(created_at)
      ORDER BY day DESC
    `).all()

    res.json({
      total,
      reviewed,
      unreviewed,
      review_rate: total > 0 ? Math.round((reviewed / total) * 100) : 0,
      oldest_unreviewed: oldestUnreviewed,
      last_review: lastReview,
      unreviewed_by_day: byDay,
    })
  })


  // ==================== RÔLES DYNAMIQUES ====================

  // GET /api/admin/roles
  router.get('/roles', (req, res) => {
    const roles = db.prepare(`
      SELECT r.*, 
      (SELECT COUNT(*) FROM users u WHERE u.custom_role = r.name) as user_count,
      (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
      FROM roles r ORDER BY r.name ASC
    `).all()
    res.json(roles)
  })

  // POST /api/admin/roles
  router.post('/roles', (req, res) => {
    const { name, description } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }
    try {
      const result = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)')
        .run(name.trim(), description || null)
      logAction(req.user.id, req.user.name, 'create', 'role', result.lastInsertRowid, `Rôle créé : ${name}`)
      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce rôle existe déjà' })
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/admin/roles/:id/permissions
  router.get('/roles/:id/permissions', (req, res) => {
    const perms = db.prepare('SELECT permission_code FROM role_permissions WHERE role_id = ?').all(req.params.id)
    res.json(perms.map(p => p.permission_code))
  })

  // POST /api/admin/roles/:id/permissions
  router.post('/roles/:id/permissions', (req, res) => {
    const { permission_code } = req.body
    if (!permission_code) return res.status(400).json({ error: 'permission_code obligatoire' })
    try {
      db.prepare('INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)')
        .run(req.params.id, permission_code)
      res.json({ success: true })
    } catch (err) {
      res.status(400).json({ error: 'Permission déjà accordée à ce rôle' })
    }
  })

  // DELETE /api/admin/roles/:id/permissions/:code
  router.delete('/roles/:id/permissions/:code', (req, res) => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_code = ?')
      .run(req.params.id, req.params.code)
    res.json({ success: true })
  })

  return router
}