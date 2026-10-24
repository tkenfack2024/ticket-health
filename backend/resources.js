import { Router } from 'express'
import cron from 'node-cron'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { userHasPermission } from './knowledge.js'

export function initResourceTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS physical_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('Lit', 'Table de travail')),
      name TEXT NOT NULL,
      unique_code TEXT UNIQUE NOT NULL,
      room_id INTEGER,
      status TEXT DEFAULT 'Disponible' CHECK(status IN ('Disponible', 'Occupé', 'En maintenance', 'Hors service')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      slot TEXT NOT NULL CHECK(slot IN ('Matin', 'Après-midi', 'Journée complète')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(resource_id, booking_date, slot),
      FOREIGN KEY (resource_id) REFERENCES physical_resources(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // === MIGRATION POUR AJOUTER LES COLONNES PATIENT (Si elles n'existent pas) ===
  const bookingColumns = db.prepare("PRAGMA table_info(resource_bookings)").all().map(c => c.name)
  
  if (!bookingColumns.includes('patient_name')) {
    db.exec("ALTER TABLE resource_bookings ADD COLUMN patient_name TEXT")
    console.log('🔧 Migration : colonne patient_name ajoutée')
  }
  if (!bookingColumns.includes('patient_dob')) {
    db.exec("ALTER TABLE resource_bookings ADD COLUMN patient_dob TEXT")
    console.log('🔧 Migration : colonne patient_dob ajoutée')
  }
  if (!bookingColumns.includes('start_date')) {
    db.exec("ALTER TABLE resource_bookings ADD COLUMN start_date TEXT")
    console.log('🔧 Migration : colonne start_date ajoutée')
  }
  if (!bookingColumns.includes('end_date')) {
    db.exec("ALTER TABLE resource_bookings ADD COLUMN end_date TEXT")
    console.log('🔧 Migration : colonne end_date ajoutée')
  }

  console.log('✅ Tables Ressources Physiques initialisées')
}

export function createResourceRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // GET /api/resources
  router.get('/', (req, res) => {
    const { type, room_id } = req.query
    let query = `
      SELECT r.*, rm.name as room_name, f.name as floor_name, s.name as site_name
      FROM physical_resources r
      LEFT JOIN rooms rm ON r.room_id = rm.id
      LEFT JOIN floors f ON rm.floor_id = f.id
      LEFT JOIN sites s ON f.site_id = s.id
      WHERE 1=1
    `
    const params = []
    if (type) { query += ' AND r.type = ?'; params.push(type) }
    if (room_id) { query += ' AND r.room_id = ?'; params.push(room_id) }
    query += ' ORDER BY r.type, r.unique_code'

    const resources = db.prepare(query).all(...params)
    res.json(resources)
  })

  // POST /api/resources
  router.post('/', adminOnly, (req, res) => {
    const { type, name, unique_code, room_id, status } = req.body
    if (!type || !name || !unique_code) return res.status(400).json({ error: 'Champs obligatoires manquants' })

    try {
      const result = db.prepare(`
        INSERT INTO physical_resources (type, name, unique_code, room_id, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(type, name, unique_code, room_id || null, status || 'Disponible')
      
      logAction(req.user.id, req.user.name, 'create', 'resource', result.lastInsertRowid, `${type} créé(e) : ${unique_code}`)
      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce numéro unique existe déjà' })
      res.status(500).json({ error: err.message })
    }
  })

  // PATCH /api/resources/:id
  router.patch('/:id', adminOnly, (req, res) => {
    const { name, unique_code, room_id, status } = req.body
    const resource = db.prepare('SELECT * FROM physical_resources WHERE id = ?').get(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Ressource non trouvée' })

    db.prepare(`
      UPDATE physical_resources SET
        name = COALESCE(?, name),
        unique_code = COALESCE(?, unique_code),
        room_id = COALESCE(?, room_id),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name, unique_code, room_id, status, req.params.id)

    res.json({ success: true })
  })

  // DELETE /api/resources/:id
  router.delete('/:id', adminOnly, (req, res) => {
    db.prepare('DELETE FROM physical_resources WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  })

  // ==================== RÉSERVATIONS ====================

  // GET /api/resources/bookings
  router.get('/bookings', (req, res) => {
    const { date } = req.query
    let query = `
      SELECT b.*, r.unique_code, r.name as resource_name, u.name as user_name
      FROM resource_bookings b
      JOIN physical_resources r ON b.resource_id = r.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `
    const params = []
    if (date) {
      query += ' AND b.booking_date = ?'
      params.push(date)
    }
    query += ' ORDER BY b.booking_date DESC, b.slot'
    
    const bookings = db.prepare(query).all(...params)

    // VÉRIFICATION DE LA PERMISSION MÉDICALE
    const hasMedicalAccess = userHasPermission(db, req.user.id, req.user.role, 'medical.read')
    
    for (const b of bookings) {
      if (hasMedicalAccess) {
        b.patient_name = decrypt(b.patient_name)
        b.patient_dob = decrypt(b.patient_dob)
        b.start_date = decrypt(b.start_date)
        b.end_date = decrypt(b.end_date)
      } else {
        delete b.patient_name
        delete b.patient_dob
        delete b.start_date
        delete b.end_date
      }
    }
    
    res.json(bookings)
  })

  // POST /api/resources/:id/book
  router.post('/:id/book', (req, res) => {
    const { booking_date, slot, patient_name, patient_dob, start_date, end_date } = req.body
    if (!booking_date || !slot) return res.status(400).json({ error: 'Date et créneau obligatoires' })

    const resource = db.prepare('SELECT * FROM physical_resources WHERE id = ?').get(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Ressource non trouvée' })

    // VÉRIFICATION DE LA PERMISSION MÉDICALE POUR LES LITS
    const hasMedicalAccess = userHasPermission(db, req.user.id, req.user.role, 'medical.read')
    
    if (resource.type === 'Lit' && !hasMedicalAccess) {
      return res.status(403).json({ error: 'Permission médicale requise pour réserver un lit' })
    }

    if (resource.type === 'Table de travail' && (patient_name || patient_dob)) {
      return res.status(400).json({ error: 'Les tables de travail ne peuvent pas avoir de données patient' })
    }

    // Chiffrement des données sensibles (uniquement si personnel médical)
    const encPatientName = (hasMedicalAccess && patient_name) ? encrypt(patient_name) : null
    const encPatientDob = (hasMedicalAccess && patient_dob) ? encrypt(patient_dob) : null
    const encStart = (hasMedicalAccess && start_date) ? encrypt(start_date) : null
    const encEnd = (hasMedicalAccess && end_date) ? encrypt(end_date) : null

    try {
      const result = db.prepare(`
        INSERT INTO resource_bookings (resource_id, user_id, booking_date, slot, patient_name, patient_dob, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.params.id, req.user.id, booking_date, slot, encPatientName, encPatientDob, encStart, encEnd)

      // Ajout de la ligne de log pour l'audit
      logAction(req.user.id, req.user.name, 'book', 'resource', req.params.id, `Réservation ${slot} le ${booking_date}`)

      res.status(201).json({ success: true, id: result.lastInsertRowid })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce créneau est déjà réservé' })
      res.status(500).json({ error: err.message })
    }
  })

  // DELETE /api/resources/bookings/:bookingId
  router.delete('/bookings/:bookingId', (req, res) => {
    const booking = db.prepare('SELECT * FROM resource_bookings WHERE id = ?').get(req.params.bookingId)
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' })

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé' })
    }

    db.prepare('DELETE FROM resource_bookings WHERE id = ?').run(req.params.bookingId)
    res.json({ success: true })
  })

  // POST /api/resources/bookings/:bookingId/release
  // Permet à un admin de libérer manuellement un lit (supprime la réservation)
  router.post('/bookings/:bookingId/release', (req, res) => {
    const booking = db.prepare('SELECT * FROM resource_bookings WHERE id = ?').get(req.params.bookingId)
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' })
    
    db.prepare('DELETE FROM resource_bookings WHERE id = ?').run(req.params.bookingId)
    logAction(req.user.id, req.user.name, 'release', 'resource', booking.resource_id, `Libération manuelle de la ressource pour le patient ${booking.patient_name || 'N/A'}`)
    
    res.json({ success: true })
  })

  return router
}

// ==================== CRON : LIBÉRATION AUTOMATIQUE ====================

export function startResourcesCron(db, logAction) {
  // S'exécute toutes les 6 heures
  cron.schedule('0 */6 * * *', () => {
    console.log('⏰ [CRON] Vérification des séjours terminés...')
    
    try {
      // On compare end_date avec la date du jour
      const expiredBookings = db.prepare(`
        SELECT id, resource_id, patient_name, end_date 
        FROM resource_bookings 
        WHERE end_date IS NOT NULL AND end_date < date('now', 'localtime')
      `).all()

      if (expiredBookings.length === 0) {
        console.log('✅ [CRON] Aucun séjour expiré.')
        return
      }

      const deleteStmt = db.prepare('DELETE FROM resource_bookings WHERE id = ?')
      for (const booking of expiredBookings) {
        deleteStmt.run(booking.id)
      }

      logAction(null, 'Système (CRON)', 'cleanup', 'resource_bookings', null, `${expiredBookings.length} séjour(s) expiré(s) libéré(s) automatiquement.`)
      console.log(`✅ [CRON] ${expiredBookings.length} séjour(s) libéré(s).`)
      
    } catch (err) {
      console.error('❌ [CRON] Erreur de nettoyage des réservations :', err)
    }
  })

  console.log('⏰ Cron de libération des lits démarré (toutes les 6 heures)')
}