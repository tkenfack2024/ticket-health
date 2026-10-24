import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'

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
  router.use(authRequired, adminOnly)

  // GET /api/facility/tree (Récupérer toute l'arborescence)
  router.get('/tree', (req, res) => {
    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all()
    for (const site of sites) {
      site.floors = db.prepare('SELECT * FROM floors WHERE site_id = ? ORDER BY name').all(site.id)
      for (const floor of site.floors) {
        floor.rooms = db.prepare('SELECT * FROM rooms WHERE floor_id = ? ORDER BY name').all(floor.id)
      }
    }
    res.json(sites)
  })

  // POST /api/facility/sites
  router.post('/sites', (req, res) => {
    const { name, address } = req.body
    if (!name) return res.status(400).json({ error: 'Nom obligatoire' })
    const result = db.prepare('INSERT INTO sites (name, address) VALUES (?, ?)').run(name, address)
    res.status(201).json({ id: result.lastInsertRowid, success: true })
  })

  // POST /api/facility/floors
  router.post('/floors', (req, res) => {
    const { site_id, name } = req.body
    if (!site_id || !name) return res.status(400).json({ error: 'Site et Nom obligatoires' })
    const result = db.prepare('INSERT INTO floors (site_id, name) VALUES (?, ?)').run(site_id, name)
    res.status(201).json({ id: result.lastInsertRowid, success: true })
  })

  // POST /api/facility/rooms
  router.post('/rooms', (req, res) => {
    const { floor_id, name, type, code, capacity } = req.body
    if (!floor_id || !name || !type) return res.status(400).json({ error: 'Champs obligatoires manquants' })
    try {
      const result = db.prepare('INSERT INTO rooms (floor_id, name, type, code, capacity) VALUES (?, ?, ?, ?, ?)').run(floor_id, name, type, code, capacity || 1)
      res.status(201).json({ id: result.lastInsertRowid, success: true })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce code de salle existe déjà' })
      res.status(500).json({ error: err.message })
    }
  })

  return router
}