// backend/stock.js
import { Router } from 'express'
import { authRequired } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================

export function initStockTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'pièce',
      current_quantity INTEGER NOT NULL DEFAULT 0,
      min_threshold INTEGER NOT NULL DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ENTREE', 'SORTIE')),
      quantity INTEGER NOT NULL,
      reason TEXT,
      user_id INTEGER,
      user_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables Stock Médical initialisées')
}

// ==================== ROUTER ====================

export function createStockRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ---- GET /api/stock ----
  router.get('/', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute('SELECT * FROM stock_items ORDER BY name ASC')
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET stock:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // MODE SQLITE
    const items = db.prepare('SELECT * FROM stock_items ORDER BY name ASC').all()
    res.json(items)
  })

  // ---- POST /api/stock ----
  router.post('/', async (req, res) => {
    const { name, category, unit, min_threshold, initial_quantity } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    const qty = parseInt(initial_quantity) || 0
    const threshold = parseInt(min_threshold) || 5

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO stock_items (name, category, unit, current_quantity, min_threshold)
                VALUES (?, ?, ?, ?, ?)`,
          args: [name.trim(), category || null, unit || 'pièce', qty, threshold]
        })
        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'stock_item', newId, `Article ajouté : ${name}`)
        
        const newItem = await tursoDb.execute({ sql: 'SELECT * FROM stock_items WHERE id = ?', args: [newId] })
        return res.status(201).json(newItem.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST stock:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // MODE SQLITE
    const result = db.prepare(`
      INSERT INTO stock_items (name, category, unit, current_quantity, min_threshold)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), category || null, unit || 'pièce', qty, threshold)

    logAction(req.user.id, req.user.name, 'create', 'stock_item', result.lastInsertRowid, `Article ajouté : ${name}`)
    const newItem = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newItem)
  })

  // ---- POST /api/stock/:id/movement ----
  // Ajouter ou retirer du stock
  router.post('/:id/movement', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { type, quantity, reason } = req.body
    const { tenantId } = req.user

    if (!['ENTREE', 'SORTIE'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide (ENTREE ou SORTIE)' })
    }
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantité invalide' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM stock_items WHERE id = ?', args: [targetId] })
        const item = check.rows[0]
        if (!item) return res.status(404).json({ error: 'Article non trouvé' })

        const newQuantity = type === 'ENTREE' ? item.current_quantity + qty : item.current_quantity - qty
        if (newQuantity < 0) return res.status(400).json({ error: 'Stock insuffisant pour cette sortie' })

        await tursoDb.execute({
          sql: 'UPDATE stock_items SET current_quantity = ? WHERE id = ?',
          args: [newQuantity, targetId]
        })
        
        await tursoDb.execute({
          sql: `INSERT INTO stock_movements (item_id, type, quantity, reason, user_id, user_name)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [targetId, type, qty, reason || null, req.user.id, req.user.name]
        })

        const actionLabel = type === 'ENTREE' ? 'Entrée' : 'Sortie'
        logAction(req.user.id, req.user.name, 'stock_movement', 'stock_item', targetId, `${actionLabel} de ${qty} ${item.unit} pour ${item.name}`)

        return res.json({ success: true, new_quantity: newQuantity })
      } catch (err) {
        console.error('Erreur Turso movement:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // MODE SQLITE
    const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(targetId)
    if (!item) return res.status(404).json({ error: 'Article non trouvé' })

    const newQuantity = type === 'ENTREE' ? item.current_quantity + qty : item.current_quantity - qty
    if (newQuantity < 0) return res.status(400).json({ error: 'Stock insuffisant pour cette sortie' })

    db.prepare('UPDATE stock_items SET current_quantity = ? WHERE id = ?').run(newQuantity, targetId)
    db.prepare(`
      INSERT INTO stock_movements (item_id, type, quantity, reason, user_id, user_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetId, type, qty, reason || null, req.user.id, req.user.name)

    const actionLabel = type === 'ENTREE' ? 'Entrée' : 'Sortie'
    logAction(req.user.id, req.user.name, 'stock_movement', 'stock_item', targetId, `${actionLabel} de ${qty} ${item.unit} pour ${item.name}`)

    res.json({ success: true, new_quantity: newQuantity })
  })

  // ---- GET /api/stock/history ----
  router.get('/history', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT m.*, s.name as item_name, s.unit as item_unit
          FROM stock_movements m
          JOIN stock_items s ON m.item_id = s.id
          ORDER BY m.created_at DESC
          LIMIT 200
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET history:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // MODE SQLITE
    const history = db.prepare(`
      SELECT m.*, s.name as item_name, s.unit as item_unit
      FROM stock_movements m
      JOIN stock_items s ON m.item_id = s.id
      ORDER BY m.created_at DESC
      LIMIT 200
    `).all()
    res.json(history)
  })

  return router
}