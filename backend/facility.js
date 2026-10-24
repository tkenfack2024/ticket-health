import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

export function initFacilityTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Bureau', 'Magasin', 'Salle de réunion', 'Salle d''opération', 'Autre')),
      code TEXT UNIQUE,
      capacity INTEGER DEFAULT 1,
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables Bâtiments/Salles initialisées')
}

export function createFacilityRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ==================== GET /api/facility/tree ====================
  // Arbre complet des sites → étages → salles
  router.get('/tree', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const sitesResult = await tursoDb.execute('SELECT * FROM sites ORDER BY name ASC')
        const floorsResult = await tursoDb.execute('SELECT * FROM floors ORDER BY name ASC')
        const roomsResult = await tursoDb.execute('SELECT * FROM rooms ORDER BY name ASC')

        const tree = sitesResult.rows.map(site => ({
          ...site,
          floors: floorsResult.rows
            .filter(f => f.site_id === site.id)
            .map(floor => ({
              ...floor,
              rooms: roomsResult.rows.filter(r => r.floor_id === floor.id)
            }))
        }))

        return res.json(tree)
      } catch (err) {
        console.error('Erreur Turso GET facility tree:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const sites = db.prepare('SELECT * FROM sites ORDER BY name ASC').all()
    const floors = db.prepare('SELECT * FROM floors ORDER BY name ASC').all()
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY name ASC').all()

    const tree = sites.map(site => ({
      ...site,
      floors: floors
        .filter(f => f.site_id === site.id)
        .map(floor => ({
          ...floor,
          rooms: rooms.filter(r => r.floor_id === floor.id)
        }))
    }))

    res.json(tree)
  })

  // ==================== POST /api/facility/sites ====================
  router.post('/sites', adminOnly, async (req, res) => {
    const { name, address } = req.body
    const { tenantId } = req.user

    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: 'INSERT INTO sites (name, address) VALUES (?, ?)',
          args: [name.trim(), address || null]
        })
        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'site', newId, `Site créé : ${name}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        console.error('Erreur Turso POST site:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const result = db.prepare('INSERT INTO sites (name, address) VALUES (?, ?)').run(name.trim(), address || null)
    logAction(req.user.id, req.user.name, 'create', 'site', result.lastInsertRowid, `Site créé : ${name}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // ==================== POST /api/facility/floors ====================
  router.post('/floors', adminOnly, async (req, res) => {
    const { site_id, name } = req.body
    const { tenantId } = req.user

    if (!site_id || !name || !name.trim()) return res.status(400).json({ error: 'site_id et nom sont obligatoires' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id FROM sites WHERE id = ?', args: [site_id] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Site non trouvé' })

        const result = await tursoDb.execute({
          sql: 'INSERT INTO floors (site_id, name) VALUES (?, ?)',
          args: [site_id, name.trim()]
        })
        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'floor', newId, `Étage créé : ${name}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        console.error('Erreur Turso POST floor:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(site_id)
    if (!site) return res.status(404).json({ error: 'Site non trouvé' })

    const result = db.prepare('INSERT INTO floors (site_id, name) VALUES (?, ?)').run(site_id, name.trim())
    logAction(req.user.id, req.user.name, 'create', 'floor', result.lastInsertRowid, `Étage créé : ${name}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // ==================== POST /api/facility/rooms ====================
  router.post('/rooms', adminOnly, async (req, res) => {
    const { floor_id, name, type, code, capacity } = req.body
    const { tenantId } = req.user

    if (!floor_id || !name || !type) return res.status(400).json({ error: 'floor_id, nom et type sont obligatoires' })
    if (!['Bureau', 'Magasin', 'Salle de réunion', 'Salle d\'opération', 'Autre'].includes(type)) {
      return res.status(400).json({ error: 'Type de salle invalide' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT id FROM floors WHERE id = ?', args: [floor_id] })
        if (check.rows.length === 0) return res.status(404).json({ error: 'Étage non trouvé' })

        const result = await tursoDb.execute({
          sql: 'INSERT INTO rooms (floor_id, name, type, code, capacity) VALUES (?, ?, ?, ?, ?)',
          args: [floor_id, name.trim(), type, code || null, capacity || 1]
        })
        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'room', newId, `Salle créée : ${name}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        console.error('Erreur Turso POST room:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const floor = db.prepare('SELECT id FROM floors WHERE id = ?').get(floor_id)
    if (!floor) return res.status(404).json({ error: 'Étage non trouvé' })

    const result = db.prepare('INSERT INTO rooms (floor_id, name, type, code, capacity) VALUES (?, ?, ?, ?, ?)')
      .run(floor_id, name.trim(), type, code || null, capacity || 1)
    logAction(req.user.id, req.user.name, 'create', 'room', result.lastInsertRowid, `Salle créée : ${name}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  return router
}