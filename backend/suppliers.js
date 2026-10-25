import { Router } from 'express'
import multer from 'multer'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

export function initSupplierTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      contract_type TEXT,
      contract_start TEXT,
      contract_end TEXT,
      status TEXT DEFAULT 'Actif' CHECK(status IN ('Actif', 'Inactif', 'En attente')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  console.log('✅ Tables Fournisseurs initialisées')
}

export function createSupplierRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  })

  // ==================== GET /api/suppliers ====================
  router.get('/', async (req, res) => {
    const { status, search } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = 'SELECT * FROM suppliers WHERE 1=1'
        const args = []
        if (status) { query += ' AND status = ?'; args.push(status) }
        if (search) {
          query += ' AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)'
          const s = `%${search}%`
          args.push(s, s, s)
        }
        query += ' ORDER BY name ASC'

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET suppliers:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = 'SELECT * FROM suppliers WHERE 1=1'
    const params = []
    if (status) { query += ' AND status = ?'; params.push(status) }
    if (search) {
      query += ' AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }
    query += ' ORDER BY name ASC'
    const suppliers = db.prepare(query).all(...params)
    res.json(suppliers)
  })

  // ==================== POST /api/suppliers ====================
  router.post('/', async (req, res) => {
    const { name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO suppliers (name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [name.trim(), contact_name || null, email || null, phone || null, contract_type || null,
                 contract_start || null, contract_end || null, status || 'Actif', notes || null]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'supplier', newId, `Fournisseur créé : ${name}`)

        const newSupplier = await tursoDb.execute({ sql: 'SELECT * FROM suppliers WHERE id = ?', args: [newId] })
        return res.status(201).json(newSupplier.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), contact_name || null, email || null, phone || null, contract_type || null,
           contract_start || null, contract_end || null, status || 'Actif', notes || null)

    logAction(req.user.id, req.user.name, 'create', 'supplier', result.lastInsertRowid, `Fournisseur créé : ${name}`)
    const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newSupplier)
  })

  // ==================== PATCH /api/suppliers/:id ====================
  router.patch('/:id', async (req, res) => {
    const { name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM suppliers WHERE id = ?', args: [req.params.id] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Fournisseur non trouvé' })

        await tursoDb.execute({
          sql: `
            UPDATE suppliers SET
              name = COALESCE(?, name),
              contact_name = COALESCE(?, contact_name),
              email = COALESCE(?, email),
              phone = COALESCE(?, phone),
              contract_type = COALESCE(?, contract_type),
              contract_start = COALESCE(?, contract_start),
              contract_end = COALESCE(?, contract_end),
              status = COALESCE(?, status),
              notes = COALESCE(?, notes)
            WHERE id = ?
          `,
          args: [name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes, req.params.id]
        })

        logAction(req.user.id, req.user.name, 'update', 'supplier', req.params.id, `Fournisseur modifié`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso PATCH supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
    if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

    db.prepare(`
      UPDATE suppliers SET
        name = COALESCE(?, name),
        contact_name = COALESCE(?, contact_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        contract_type = COALESCE(?, contract_type),
        contract_start = COALESCE(?, contract_start),
        contract_end = COALESCE(?, contract_end),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes, req.params.id)

    logAction(req.user.id, req.user.name, 'update', 'supplier', req.params.id, `Fournisseur modifié`)
    res.json({ success: true })
  })

  // ==================== DELETE /api/suppliers/:id ====================
  router.delete('/:id', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM suppliers WHERE id = ?', args: [req.params.id] })
        const supplier = check.rows[0]
        if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

        await tursoDb.execute({ sql: 'DELETE FROM suppliers WHERE id = ?', args: [req.params.id] })
        logAction(req.user.id, req.user.name, 'delete', 'supplier', req.params.id, `Fournisseur supprimé : ${supplier.name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE supplier:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
    if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
    logAction(req.user.id, req.user.name, 'delete', 'supplier', req.params.id, `Fournisseur supprimé : ${supplier.name}`)
    res.json({ success: true })
  })

  // ==================== FICHIERS ====================
  
  // GET /api/suppliers/:id/files
  router.get('/:id/files', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `SELECT id, supplier_id, filename, mimetype, size, uploaded_by, uploaded_at FROM supplier_files WHERE supplier_id = ? ORDER BY id DESC`,
          args: [req.params.id]
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET supplier files:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const files = db.prepare(`
      SELECT id, supplier_id, filename, mimetype, size, uploaded_by, uploaded_at 
      FROM supplier_files WHERE supplier_id = ? ORDER BY id DESC
    `).all(req.params.id)
    res.json(files)
  })

  // POST /api/suppliers/:id/files
  router.post('/:id/files', upload.single('file'), async (req, res) => {
    const { tenantId } = req.user
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id FROM suppliers WHERE id = ?', args: [req.params.id] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Fournisseur non trouvé' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO supplier_files (supplier_id, filename, mimetype, size, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [req.params.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user.id]
        })

        logAction(req.user.id, req.user.name, 'upload', 'supplier', req.params.id, `Fichier ajouté : ${req.file.originalname}`)
        return res.status(201).json({ success: true, id: Number(result.lastInsertRowid) })
      } catch (err) {
        console.error('Erreur Turso POST supplier file:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id)
    if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

    const result = db.prepare(`
      INSERT INTO supplier_files (supplier_id, filename, mimetype, size, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user.id)

    logAction(req.user.id, req.user.name, 'upload', 'supplier', req.params.id, `Fichier ajouté : ${req.file.originalname}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // DELETE /api/suppliers/files/:fileId
  router.delete('/files/:fileId', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({ sql: 'DELETE FROM supplier_files WHERE id = ?', args: [req.params.fileId] })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE supplier file:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    db.prepare('DELETE FROM supplier_files WHERE id = ?').run(req.params.fileId)
    res.json({ success: true })
  })

  // GET /api/suppliers/files/:fileId/download
  router.get('/files/:fileId/download', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({ sql: 'SELECT * FROM supplier_files WHERE id = ?', args: [req.params.fileId] })
        const file = result.rows[0]
        if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

        res.setHeader('Content-Type', file.mimetype)
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
        return res.send(file.data)
      } catch (err) {
        console.error('Erreur Turso download supplier file:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const file = db.prepare('SELECT * FROM supplier_files WHERE id = ?').get(req.params.fileId)
    if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.data)
  })

  return router
}