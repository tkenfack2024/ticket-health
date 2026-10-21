import { Router } from 'express'
import multer from 'multer'
import { authRequired, adminOnly } from './auth.js'

// ==================== INITIALISATION ====================

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

// ==================== ROUTES ====================

export function createSupplierRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // Configuration Multer pour stocker en mémoire (afin de l'insérer en BLOB)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5 Mo max
  })

  // ---- GET /api/suppliers ----
  router.get('/', (req, res) => {
    const { search, status } = req.query
    let query = 'SELECT * FROM suppliers WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    query += ' ORDER BY name ASC'

    const suppliers = db.prepare(query).all(...params)
    res.json(suppliers)
  })

  // ---- POST /api/suppliers ----
  router.post('/', (req, res) => {
    const { name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), contact_name, email, phone, contract_type, contract_start, contract_end, status || 'Actif', notes)

    logAction(req.user.id, req.user.name, 'create', 'supplier', result.lastInsertRowid, `Fournisseur créé : ${name}`)
    res.status(201).json({ id: result.lastInsertRowid, success: true })
  })

  // ---- PATCH /api/suppliers/:id ----
  router.patch('/:id', (req, res) => {
    const { name, contact_name, email, phone, contract_type, contract_start, contract_end, status, notes } = req.body
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

  // ---- DELETE /api/suppliers/:id ----
  router.delete('/:id', (req, res) => {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
    if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id)
    logAction(req.user.id, req.user.name, 'delete', 'supplier', req.params.id, `Fournisseur supprimé : ${supplier.name}`)
    res.json({ success: true })
  })

  // ==================== ROUTES FICHIERS ====================

  // ---- GET /api/suppliers/:id/files ----
  router.get('/:id/files', (req, res) => {
    const files = db.prepare(`
      SELECT id, filename, mimetype, size, uploaded_at 
      FROM supplier_files 
      WHERE supplier_id = ? 
      ORDER BY id DESC
    `).all(req.params.id)
    res.json(files)
  })

  // ---- POST /api/suppliers/:id/files ----
  router.post('/:id/files', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' })

    const { originalname, mimetype, size, buffer } = req.file

    // Vérifier que le fournisseur existe
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id)
    if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' })

    const result = db.prepare(`
      INSERT INTO supplier_files (supplier_id, filename, mimetype, size, data, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, originalname, mimetype, size, buffer, req.user.id)

    logAction(req.user.id, req.user.name, 'upload', 'supplier_file', result.lastInsertRowid, `Fichier ajouté : ${originalname}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // ---- GET /api/suppliers/files/:fileId/download ----
  // Attention : cette route doit être déclarée AVANT /:id pour éviter les conflits
  router.get('/files/:fileId/download', (req, res) => {
    const file = db.prepare('SELECT * FROM supplier_files WHERE id = ?').get(req.params.fileId)
    if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`)
    res.send(file.data)
  })

  // ---- DELETE /api/suppliers/files/:fileId ----
  router.delete('/files/:fileId', (req, res) => {
    const file = db.prepare('SELECT * FROM supplier_files WHERE id = ?').get(req.params.fileId)
    if (!file) return res.status(404).json({ error: 'Fichier non trouvé' })

    db.prepare('DELETE FROM supplier_files WHERE id = ?').run(req.params.fileId)
    logAction(req.user.id, req.user.name, 'delete', 'supplier_file', req.params.fileId, `Fichier supprimé : ${file.filename}`)
    res.json({ success: true })
  })

  return router
}