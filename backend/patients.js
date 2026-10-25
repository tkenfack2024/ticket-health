import { Router } from 'express'
import multer from 'multer'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
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

export function initPatientTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('M', 'F', 'Autre')),
      phone TEXT,
      address TEXT,
      nir TEXT,
      blood_type TEXT,
      allergies TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'En attente' CHECK(status IN ('En attente', 'En consultation', 'Terminé', 'Annulé')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      visit_id INTEGER,
      doctor_id INTEGER NOT NULL,
      chief_complaint TEXT,
      diagnosis TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      medication TEXT NOT NULL,
      dosage TEXT,
      duration TEXT,
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Terminée', 'Annulée')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      exam_type TEXT NOT NULL,
      status TEXT DEFAULT 'En attente' CHECK(status IN ('En attente', 'En cours', 'Résultat disponible')),
      result_notes TEXT,
      file_data BLOB,
      file_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )
  `)

  // Migration
  const examColumns = db.prepare("PRAGMA table_info(exam_results)").all().map(c => c.name)
  if (!examColumns.includes('file_data')) {
    db.exec("ALTER TABLE exam_results ADD COLUMN file_data BLOB")
    console.log('🔧 Migration : colonne file_data ajoutée à exam_results')
  }
  if (!examColumns.includes('file_name')) {
    db.exec("ALTER TABLE exam_results ADD COLUMN file_name TEXT")
    console.log('🔧 Migration : colonne file_name ajoutée à exam_results')
  }

  console.log('✅ Tables Patients initialisées')
}

export function createPatientRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  })

  // ==================== GET /api/patients ====================
  router.get('/', async (req, res) => {
    const { search } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = 'SELECT * FROM patients WHERE 1=1'
        const args = []
        if (search) {
          query += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_code LIKE ?)'
          const s = `%${search}%`
          args.push(s, s, s)
        }
        query += ' ORDER BY last_name ASC, first_name ASC'

        const result = await tursoDb.execute({ sql: query, args })
        const patients = result.rows
        const hasMedicalAccess = await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'medical.read')

        for (const p of patients) {
          if (hasMedicalAccess) {
            p.nir = decrypt(p.nir)
            p.allergies = decrypt(p.allergies)
          } else {
            delete p.nir
            delete p.allergies
          }
        }
        return res.json(patients)
      } catch (err) {
        console.error('Erreur Turso GET patients:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    let query = 'SELECT * FROM patients WHERE 1=1'
    const params = []
    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_code LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }
    query += ' ORDER BY last_name ASC, first_name ASC'
    const patients = db.prepare(query).all(...params)
    const hasMedicalAccess = userHasPermission(db, req.user.id, req.user.role, 'medical.read')
    for (const p of patients) {
      if (hasMedicalAccess) {
        p.nir = decrypt(p.nir)
        p.allergies = decrypt(p.allergies)
      } else {
        delete p.nir
        delete p.allergies
      }
    }
    res.json(patients)
  })

  // ==================== GET /api/patients/visits ====================
  router.get('/visits', async (req, res) => {
    const { status } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT v.*, p.id as patient_id, p.first_name, p.last_name, p.patient_code, p.dob, u.name as doctor_name
          FROM visits v
          JOIN patients p ON v.patient_id = p.id
          LEFT JOIN users u ON v.doctor_id = u.id
          WHERE 1=1
        `
        const args = []
        if (status) {
          query += ' AND v.status = ?'
          args.push(status)
        }
        if (req.user.role === 'technicien') {
          query += ' AND (v.doctor_id = ? OR v.doctor_id IS NULL)'
          args.push(req.user.id)
        }
        query += ' ORDER BY v.created_at ASC'

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET visits:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    let query = `
      SELECT v.*, p.id as patient_id, p.first_name, p.last_name, p.patient_code, p.dob, u.name as doctor_name
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.doctor_id = u.id
      WHERE 1=1
    `
    const params = []
    if (status) {
      query += ' AND v.status = ?'
      params.push(status)
    }
    if (req.user.role === 'technicien') {
      query += ' AND (v.doctor_id = ? OR v.doctor_id IS NULL)'
      params.push(req.user.id)
    }
    query += ' ORDER BY v.created_at ASC'
    const visits = db.prepare(query).all(...params)
    res.json(visits)
  })

  // ==================== GET /api/patients/prescriptions/pending ====================
  router.get('/prescriptions/pending', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT p.*, pt.first_name, pt.last_name, pt.patient_code 
          FROM prescriptions p
          JOIN patients pt ON p.patient_id = pt.id
          WHERE p.status = 'Active'
          ORDER BY p.created_at DESC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso prescriptions pending:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const prescs = db.prepare(`
      SELECT p.*, pt.first_name, pt.last_name, pt.patient_code 
      FROM prescriptions p
      JOIN patients pt ON p.patient_id = pt.id
      WHERE p.status = 'Active'
      ORDER BY p.created_at DESC
    `).all()
    res.json(prescs)
  })

  // ==================== PATCH /api/patients/prescriptions/:id/finish ====================
  router.patch('/prescriptions/:id/finish', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: "UPDATE prescriptions SET status = 'Terminée' WHERE id = ?",
          args: [req.params.id]
        })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso patch prescription:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    db.prepare("UPDATE prescriptions SET status = 'Terminée' WHERE id = ?").run(req.params.id)
    res.json({ success: true })
  })

  // ==================== GET /api/patients/exams/pending ====================
  router.get('/exams/pending', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT e.*, pt.first_name, pt.last_name, pt.patient_code 
          FROM exam_results e
          JOIN patients pt ON e.patient_id = pt.id
          WHERE e.status != 'Résultat disponible'
          ORDER BY e.created_at DESC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso exams pending:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const exams = db.prepare(`
      SELECT e.*, pt.first_name, pt.last_name, pt.patient_code 
      FROM exam_results e
      JOIN patients pt ON e.patient_id = pt.id
      WHERE e.status != 'Résultat disponible'
      ORDER BY e.created_at DESC
    `).all()
    res.json(exams)
  })

  // ==================== POST /api/patients/visits/:id/start ====================
  router.post('/visits/:id/start', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: `
            UPDATE visits 
            SET status = 'En consultation', 
                started_at = datetime('now', 'localtime'), 
                doctor_id = ? 
            WHERE id = ?
          `,
          args: [req.user.id, req.params.id]
        })
        logAction(req.user.id, req.user.name, 'start', 'visit', req.params.id, `Début de la consultation`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso start visit:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    db.prepare(`
      UPDATE visits 
      SET status = 'En consultation', 
          started_at = datetime('now', 'localtime'), 
          doctor_id = ? 
      WHERE id = ?
    `).run(req.user.id, req.params.id)
    logAction(req.user.id, req.user.name, 'start', 'visit', req.params.id, `Début de la consultation`)
    res.json({ success: true })
  })

  // ==================== POST /api/patients ====================
  router.post('/', async (req, res) => {
    const { first_name, last_name, dob, gender, phone, address, nir, blood_type, allergies } = req.body
    const { tenantId } = req.user

    if (!first_name || !last_name || !dob) {
      return res.status(400).json({ error: 'Nom, prénom et date de naissance sont obligatoires' })
    }

    const encNir = nir ? encrypt(nir) : null
    const encAllergies = allergies ? encrypt(allergies) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const lastResult = await tursoDb.execute("SELECT patient_code FROM patients ORDER BY id DESC LIMIT 1")
        const lastPatient = lastResult.rows[0]
        let nextNumber = 1
        if (lastPatient && lastPatient.patient_code) {
          const lastNum = parseInt(lastPatient.patient_code.split('-')[1])
          if (!isNaN(lastNum)) nextNumber = lastNum + 1
        }
        const patient_code = `PAT-${nextNumber.toString().padStart(4, '0')}`

        const result = await tursoDb.execute({
          sql: `INSERT INTO patients (patient_code, first_name, last_name, dob, gender, phone, address, nir, blood_type, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [patient_code, first_name, last_name, dob, gender || 'Autre', phone, address, encNir, blood_type, encAllergies]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'patient', newId, `Patient créé : ${first_name} ${last_name} (${patient_code})`)
        return res.status(201).json({ success: true, id: newId, patient_code })
      } catch (err) {
        console.error('Erreur Turso POST patient:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    try {
      const lastPatient = db.prepare("SELECT patient_code FROM patients ORDER BY id DESC LIMIT 1").get()
      let nextNumber = 1
      if (lastPatient && lastPatient.patient_code) {
        const lastNum = parseInt(lastPatient.patient_code.split('-')[1])
        if (!isNaN(lastNum)) nextNumber = lastNum + 1
      }
      const patient_code = `PAT-${nextNumber.toString().padStart(4, '0')}`
      const result = db.prepare(`
        INSERT INTO patients (patient_code, first_name, last_name, dob, gender, phone, address, nir, blood_type, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patient_code, first_name, last_name, dob, gender || 'Autre', phone, address, encNir, blood_type, encAllergies)
      logAction(req.user.id, req.user.name, 'create', 'patient', result.lastInsertRowid, `Patient créé : ${first_name} ${last_name} (${patient_code})`)
      res.status(201).json({ success: true, id: result.lastInsertRowid, patient_code })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ==================== GET /api/patients/:id/records ====================
  router.get('/:id/records', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const recordsResult = await tursoDb.execute({
          sql: `
            SELECT m.*, u.name as doctor_name FROM medical_records m
            LEFT JOIN users u ON m.doctor_id = u.id
            WHERE m.patient_id = ? ORDER BY m.created_at DESC
          `,
          args: [req.params.id]
        })
        const records = recordsResult.rows

        const examsResult = await tursoDb.execute({
          sql: `SELECT * FROM exam_results WHERE patient_id = ? ORDER BY created_at DESC`,
          args: [req.params.id]
        })
        const exams = examsResult.rows

        for (const r of records) {
          r.exams = exams.filter(e => e.record_id === r.id)
        }

        const hasMedicalAccess = await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'medical.read')
        for (const r of records) {
          if (hasMedicalAccess) {
            r.chief_complaint = decrypt(r.chief_complaint)
            r.diagnosis = decrypt(r.diagnosis)
            r.notes = decrypt(r.notes)
          } else {
            r.chief_complaint = '[Chiffré]'
            r.diagnosis = '[Chiffré]'
            r.notes = '[Chiffré]'
          }
        }
        return res.json(records)
      } catch (err) {
        console.error('Erreur Turso GET records:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const records = db.prepare(`
      SELECT m.*, u.name as doctor_name FROM medical_records m
      LEFT JOIN users u ON m.doctor_id = u.id
      WHERE m.patient_id = ? ORDER BY m.created_at DESC
    `).all(req.params.id)

    const exams = db.prepare(`SELECT * FROM exam_results WHERE patient_id = ? ORDER BY created_at DESC`).all(req.params.id)
    for (const r of records) {
      r.exams = exams.filter(e => e.record_id === r.id)
    }

    const hasMedicalAccess = userHasPermission(db, req.user.id, req.user.role, 'medical.read')
    for (const r of records) {
      if (hasMedicalAccess) {
        r.chief_complaint = decrypt(r.chief_complaint)
        r.diagnosis = decrypt(r.diagnosis)
        r.notes = decrypt(r.notes)
      } else {
        r.chief_complaint = '[Chiffré]'
        r.diagnosis = '[Chiffré]'
        r.notes = '[Chiffré]'
      }
    }
    res.json(records)
  })

  // ==================== POST /api/patients/:id/records ====================
  router.post('/:id/records', async (req, res) => {
    const { visit_id, chief_complaint, diagnosis, notes } = req.body
    const { tenantId } = req.user
    const encComplaint = chief_complaint ? encrypt(chief_complaint) : null
    const encDiagnosis = diagnosis ? encrypt(diagnosis) : null
    const encNotes = notes ? encrypt(notes) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO medical_records (patient_id, visit_id, doctor_id, chief_complaint, diagnosis, notes)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [req.params.id, visit_id || null, req.user.id, encComplaint, encDiagnosis, encNotes]
        })

        if (visit_id) {
          await tursoDb.execute({
            sql: `UPDATE visits SET status = 'Terminé', finished_at = datetime('now', 'localtime') WHERE id = ?`,
            args: [visit_id]
          })
        }

        const newRecordId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'medical_record', newRecordId, `Consultation enregistrée`)
        return res.status(201).json({ success: true, id: newRecordId })
      } catch (err) {
        console.error('Erreur Turso POST record:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const result = db.prepare(`
      INSERT INTO medical_records (patient_id, visit_id, doctor_id, chief_complaint, diagnosis, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, visit_id || null, req.user.id, encComplaint, encDiagnosis, encNotes)

    if (visit_id) {
      db.prepare(`UPDATE visits SET status = 'Terminé', finished_at = datetime('now', 'localtime') WHERE id = ?`).run(visit_id)
    }
    logAction(req.user.id, req.user.name, 'create', 'medical_record', result.lastInsertRowid, `Consultation enregistrée`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // ==================== POST /api/patients/:id/visit ====================
  router.post('/:id/visit', async (req, res) => {
    const { doctor_id, reason } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const patientResult = await tursoDb.execute({
          sql: 'SELECT id FROM patients WHERE id = ?',
          args: [req.params.id]
        })
        if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Patient non trouvé' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO visits (patient_id, doctor_id, reason, status) VALUES (?, ?, ?, 'En attente')`,
          args: [req.params.id, doctor_id || null, reason || 'Consultation standard']
        })

        const newVisitId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'visit', newVisitId, `Patient envoyé en consultation`)
        return res.status(201).json({ success: true, id: newVisitId })
      } catch (err) {
        console.error('Erreur Turso POST visit:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(req.params.id)
    if (!patient) return res.status(404).json({ error: 'Patient non trouvé' })
    const result = db.prepare(`
      INSERT INTO visits (patient_id, doctor_id, reason, status) VALUES (?, ?, ?, 'En attente')
    `).run(req.params.id, doctor_id || null, reason || 'Consultation standard')
    logAction(req.user.id, req.user.name, 'create', 'visit', result.lastInsertRowid, `Patient envoyé en consultation`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  // ==================== ORDONNANCES & EXAMENS ====================
  router.get('/records/:recordId/prescriptions', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: 'SELECT * FROM prescriptions WHERE record_id = ?',
          args: [req.params.recordId]
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET prescriptions:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const prescs = db.prepare('SELECT * FROM prescriptions WHERE record_id = ?').all(req.params.recordId)
    res.json(prescs)
  })

  router.post('/records/:recordId/prescriptions', async (req, res) => {
    const { medication, dosage, duration } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const recordResult = await tursoDb.execute({
          sql: 'SELECT patient_id FROM medical_records WHERE id = ?',
          args: [req.params.recordId]
        })
        const record = recordResult.rows[0]
        if (!record) return res.status(404).json({ error: 'Consultation non trouvée' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO prescriptions (record_id, patient_id, medication, dosage, duration) VALUES (?, ?, ?, ?, ?)`,
          args: [req.params.recordId, record.patient_id, medication, dosage, duration]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'prescribe', 'medical_record', req.params.recordId, `Ordonnance : ${medication}`)
        return res.status(201).json({ success: true, id: newId })
      } catch (err) {
        console.error('Erreur Turso POST prescription:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const record = db.prepare('SELECT patient_id FROM medical_records WHERE id = ?').get(req.params.recordId)
    if (!record) return res.status(404).json({ error: 'Consultation non trouvée' })
    const result = db.prepare(`
      INSERT INTO prescriptions (record_id, patient_id, medication, dosage, duration) VALUES (?, ?, ?, ?, ?)
    `).run(req.params.recordId, record.patient_id, medication, dosage, duration)
    logAction(req.user.id, req.user.name, 'prescribe', 'medical_record', req.params.recordId, `Ordonnance : ${medication}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  router.post('/records/:recordId/exams', async (req, res) => {
    const { exam_type } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const recordResult = await tursoDb.execute({
          sql: 'SELECT patient_id FROM medical_records WHERE id = ?',
          args: [req.params.recordId]
        })
        const record = recordResult.rows[0]
        if (!record) return res.status(404).json({ error: 'Consultation non trouvée' })

        const result = await tursoDb.execute({
          sql: `INSERT INTO exam_results (record_id, patient_id, exam_type) VALUES (?, ?, ?)`,
          args: [req.params.recordId, record.patient_id, exam_type]
        })

        return res.status(201).json({ success: true, id: Number(result.lastInsertRowid) })
      } catch (err) {
        console.error('Erreur Turso POST exam:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const record = db.prepare('SELECT patient_id FROM medical_records WHERE id = ?').get(req.params.recordId)
    if (!record) return res.status(404).json({ error: 'Consultation non trouvée' })
    const result = db.prepare(`
      INSERT INTO exam_results (record_id, patient_id, exam_type) VALUES (?, ?, ?)
    `).run(req.params.recordId, record.patient_id, exam_type)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  })

  router.get('/:id/exams', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: 'SELECT * FROM exam_results WHERE patient_id = ? ORDER BY created_at DESC',
          args: [req.params.id]
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET exams:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const exams = db.prepare('SELECT * FROM exam_results WHERE patient_id = ? ORDER BY created_at DESC').all(req.params.id)
    res.json(exams)
  })

  router.patch('/exams/:examId', upload.single('file'), async (req, res) => {
    const { status, result_notes } = req.body
    const { tenantId } = req.user
    const fileData = req.file ? req.file.buffer : null
    const fileName = req.file ? req.file.originalname : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        await tursoDb.execute({
          sql: `UPDATE exam_results SET status = COALESCE(?, status), result_notes = COALESCE(?, result_notes), file_data = COALESCE(?, file_data), file_name = COALESCE(?, file_name) WHERE id = ?`,
          args: [status, result_notes, fileData, fileName, req.params.examId]
        })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso PATCH exam:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    db.prepare(`
      UPDATE exam_results SET status = COALESCE(?, status), result_notes = COALESCE(?, result_notes), file_data = COALESCE(?, file_data), file_name = COALESCE(?, file_name) WHERE id = ?
    `).run(status, result_notes, fileData, fileName, req.params.examId)
    res.json({ success: true })
  })

  router.get('/exams/:examId/download', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: 'SELECT * FROM exam_results WHERE id = ?',
          args: [req.params.examId]
        })
        const exam = result.rows[0]
        if (!exam || !exam.file_data) return res.status(404).json({ error: 'Fichier non trouvé' })

        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${exam.file_name}"`)
        return res.send(exam.file_data)
      } catch (err) {
        console.error('Erreur Turso download:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const exam = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(req.params.examId)
    if (!exam || !exam.file_data) return res.status(404).json({ error: 'Fichier non trouvé' })
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${exam.file_name}"`)
    res.send(exam.file_data)
  })

  // ==================== DELETE /api/patients/:id ====================
  router.delete('/:id', async (req, res) => {
    const { tenantId } = req.user

    // --- MODE TURSO ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        // Vérifier que le patient existe
        const checkResult = await tursoDb.execute({
          sql: 'SELECT id, first_name, last_name FROM patients WHERE id = ?',
          args: [req.params.id]
        })
        const patient = checkResult.rows[0]
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé' })

        // Supprimer le patient (les tables liées ont ON DELETE CASCADE)
        await tursoDb.execute({
          sql: 'DELETE FROM patients WHERE id = ?',
          args: [req.params.id]
        })

        logAction(req.user.id, req.user.name, 'delete', 'patient', req.params.id, `Patient supprimé : ${patient.first_name} ${patient.last_name}`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE patient:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const patient = db.prepare('SELECT id, first_name, last_name FROM patients WHERE id = ?').get(req.params.id)
    if (!patient) return res.status(404).json({ error: 'Patient non trouvé' })

    db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id)
    logAction(req.user.id, req.user.name, 'delete', 'patient', req.params.id, `Patient supprimé : ${patient.first_name} ${patient.last_name}`)
    res.json({ success: true })
  })

  // ==================== GET /:id (DOIT ÊTRE LE DERNIER) ====================
  router.get('/:id', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: 'SELECT * FROM patients WHERE id = ?',
          args: [req.params.id]
        })
        const patient = result.rows[0]
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé' })

        const hasMedicalAccess = await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'medical.read')
        if (hasMedicalAccess) {
          patient.nir = decrypt(patient.nir)
          patient.allergies = decrypt(patient.allergies)
        } else {
          delete patient.nir
          delete patient.allergies
        }
        return res.json(patient)
      } catch (err) {
        console.error('Erreur Turso GET patient:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id)
    if (!patient) return res.status(404).json({ error: 'Patient non trouvé' })
    const hasMedicalAccess = userHasPermission(db, req.user.id, req.user.role, 'medical.read')
    if (hasMedicalAccess) {
      patient.nir = decrypt(patient.nir)
      patient.allergies = decrypt(patient.allergies)
    } else {
      delete patient.nir
      delete patient.allergies
    }
    res.json(patient)
  })

  return router
}