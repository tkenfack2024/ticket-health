// backend/patients-import-export.js
// Import/Export patients avec chiffrement AES-256-GCM et validation

import crypto from 'crypto'
import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== CHIFFREMENT AES-256-GCM ====================
// Format binaire : [version:1][iv:12][authTag:16][ciphertext]
// Mot de passe dérivé via scrypt (32 bytes)

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const VERSION = 1
const SCRYPT_SALT = Buffer.from('healthticket-patient-export-v1')

function deriveKey(password) {
  return crypto.scryptSync(password, SCRYPT_SALT, 32)
}

export function encryptBuffer(buffer, password) {
  const key = deriveKey(password)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    authTag,
    encrypted,
  ])
}

export function decryptBuffer(ciphertext, password) {
  if (ciphertext[0] !== VERSION) {
    throw new Error('Version de chiffrement non supportée')
  }
  const iv = ciphertext.subarray(1, 1 + IV_LENGTH)
  const authTag = ciphertext.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = ciphertext.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH)

  const key = deriveKey(password)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

// ==================== HELPERS CSV ====================

export const CSV_HEADERS = [
  'patient_code', 'first_name', 'last_name', 'dob', 'gender',
  'phone', 'address', 'blood_type', 'nir', 'allergies',
]

export function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function parseCsv(content) {
  // Parseur CSV robuste : gère guillemets, virgules, retours ligne
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < content.length) {
    const c = content[i]

    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
    } else {
      if (c === '"') { inQuotes = true; i++; continue }
      if (c === ',') { current.push(field); field = ''; i++; continue }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && content[i + 1] === '\n') i++
        current.push(field); field = ''
        if (current.some(v => v !== '')) rows.push(current)
        current = []
        i++
        continue
      }
      field += c
      i++
    }
  }

  if (field !== '' || current.length > 0) {
    current.push(field)
    if (current.some(v => v !== '')) rows.push(current)
  }

  if (rows.length === 0) return { headers: [], data: [] }

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const data = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, idx) => { obj[h] = row[idx]?.trim() || '' })
    return obj
  })

  return { headers, data }
}

// ==================== VALIDATION ====================

export function validatePatientRow(row, index) {
  const errors = []
  const normalized = {}

  if (!row.first_name || !row.first_name.trim()) errors.push(`Ligne ${index + 2} : prénom manquant`)
  if (!row.last_name || !row.last_name.trim()) errors.push(`Ligne ${index + 2} : nom manquant`)
  if (!row.dob || !row.dob.trim()) errors.push(`Ligne ${index + 2} : date de naissance manquante`)
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dob)) errors.push(`Ligne ${index + 2} : date invalide (attendu AAAA-MM-JJ)`)

  if (row.gender && !['M', 'F', 'Autre'].includes(row.gender)) {
    errors.push(`Ligne ${index + 2} : genre invalide (M, F ou Autre)`)
  }

  normalized.first_name = row.first_name?.trim() || null
  normalized.last_name = row.last_name?.trim() || null
  normalized.dob = row.dob?.trim() || null
  normalized.gender = row.gender?.trim() || 'Autre'
  normalized.phone = row.phone?.trim() || null
  normalized.address = row.address?.trim() || null
  normalized.blood_type = row.blood_type?.trim() || null
  normalized.nir = row.nir?.trim() || null
  normalized.allergies = row.allergies?.trim() || null
  normalized.patient_code = row.patient_code?.trim() || null

  return { errors, normalized }
}


// ==================== ROUTER ====================

export function createPatientsImportExportRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/admin/patients/columns ----
  router.get('/columns', (req, res) => {
    res.json({
      columns: CSV_HEADERS,
      required: ['first_name', 'last_name', 'dob'],
      optional: ['patient_code', 'gender', 'phone', 'address', 'blood_type', 'nir', 'allergies'],
    })
  })

  // ---- POST /api/admin/patients/export ----
  router.post('/export', async (req, res) => {
    const { password, tenant_id } = req.body
    const { tenantId } = req.user

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe requis (8 caractères minimum)' })
    }

    const effectiveTenant = tenant_id || tenantId || null

    try {
      let patients = []

      // --- MODE TURSO ---
      if (effectiveTenant) {
        const tenant = TENANTS[effectiveTenant]
        if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })

        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        const result = await tursoDb.execute('SELECT * FROM patients ORDER BY patient_code ASC')
        patients = result.rows

        for (const p of patients) {
          p.nir = p.nir ? decrypt(p.nir) : ''
          p.allergies = p.allergies ? decrypt(p.allergies) : ''
        }
      } else {
        // --- MODE SQLITE ---
        patients = db.prepare('SELECT * FROM patients ORDER BY patient_code ASC').all()
        for (const p of patients) {
          p.nir = p.nir ? decrypt(p.nir) : ''
          p.allergies = p.allergies ? decrypt(p.allergies) : ''
        }
      }

      // Construire le CSV
      const lines = [CSV_HEADERS.join(',')]
      for (const p of patients) {
        lines.push(CSV_HEADERS.map(h => escapeCsv(p[h])).join(','))
      }
      const csvContent = '\uFEFF' + lines.join('\n')
      const csvBuffer = Buffer.from(csvContent, 'utf-8')

      // Chiffrer
      const encrypted = encryptBuffer(csvBuffer, password)

      // Journaliser
      logAction(
        req.user.id, req.user.name, 'export', 'patients', null,
        `Export de ${patients.length} patient(s) — format chiffré AES-256-GCM — tenant: ${effectiveTenant || 'local'}`
      )

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `patients-${effectiveTenant || 'local'}-${dateStr}.enc`
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('X-Patient-Count', String(patients.length))

      return res.send(encrypted)
    } catch (err) {
      console.error('Erreur export patients:', err)
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- POST /api/admin/patients/import/preview ----
  router.post('/import/preview', async (req, res) => {
    const { password, tenant_id } = req.body
    const { tenantId } = req.user
    const file = req.file

    if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' })
    if (!password || password.length < 8) return res.status(400).json({ error: 'Mot de passe requis' })

    const effectiveTenant = tenant_id || tenantId || null

    try {
      let csvContent
      try {
        const decrypted = decryptBuffer(file.buffer, password)
        csvContent = decrypted.toString('utf-8').replace(/^\uFEFF/, '')
      } catch (e) {
        return res.status(400).json({ error: 'Mot de passe incorrect ou fichier corrompu' })
      }

      const { headers, data } = parseCsv(csvContent)

      if (data.length === 0) {
        return res.status(400).json({ error: 'Le fichier ne contient aucune ligne de données' })
      }

      const valid = []
      const allErrors = []
      for (let i = 0; i < data.length; i++) {
        const { errors, normalized } = validatePatientRow(data[i], i)
        if (errors.length > 0) allErrors.push(...errors)
        else valid.push(normalized)
      }

      // Détecter doublons
      let existing
      if (effectiveTenant) {
        const tenant = TENANTS[effectiveTenant]
        if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        existing = (await tursoDb.execute('SELECT patient_code, first_name, last_name, dob FROM patients')).rows
      } else {
        existing = db.prepare('SELECT patient_code, first_name, last_name, dob FROM patients').all()
      }

      const existingCodes = new Set(existing.map(p => p.patient_code).filter(Boolean))
      const existingIdentities = new Set(existing.map(p => `${p.first_name}|${p.last_name}|${p.dob}`.toLowerCase()))

      const duplicates = []
      const newPatients = []
      for (const p of valid) {
        const identity = `${p.first_name}|${p.last_name}|${p.dob}`.toLowerCase()
        if (p.patient_code && existingCodes.has(p.patient_code)) {
          duplicates.push({ ...p, reason: `Code patient ${p.patient_code} existe déjà` })
        } else if (existingIdentities.has(identity)) {
          duplicates.push({ ...p, reason: 'Patient déjà existant (nom + prénom + date de naissance)' })
        } else {
          newPatients.push(p)
        }
      }

      logAction(
        req.user.id, req.user.name, 'import-preview', 'patients', null,
        `Aperçu import : ${data.length} lignes, ${newPatients.length} nouveaux, ${duplicates.length} doublons, ${allErrors.length} erreurs`
      )

      return res.json({
        total_lines: data.length,
        valid_count: valid.length,
        new_count: newPatients.length,
        duplicate_count: duplicates.length,
        error_count: allErrors.length,
        errors: allErrors.slice(0, 50),
        duplicates: duplicates.slice(0, 50),
        preview: newPatients.slice(0, 10),
        headers_detected: headers,
      })
    } catch (err) {
      console.error('Erreur preview import:', err)
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- POST /api/admin/patients/import/confirm ----
  router.post('/import/confirm', async (req, res) => {
    const { password, tenant_id, confirm } = req.body
    const { tenantId } = req.user
    const file = req.file

    if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' })
    if (!password) return res.status(400).json({ error: 'Mot de passe requis' })
    if (confirm !== 'true') return res.status(400).json({ error: 'Confirmation requise (confirm=true)' })

    const effectiveTenant = tenant_id || tenantId || null

    try {
      const decrypted = decryptBuffer(file.buffer, password)
      const csvContent = decrypted.toString('utf-8').replace(/^\uFEFF/, '')
      const { data } = parseCsv(csvContent)

      const valid = []
      for (let i = 0; i < data.length; i++) {
        const { errors, normalized } = validatePatientRow(data[i], i)
        if (errors.length === 0) valid.push(normalized)
      }

      if (valid.length === 0) return res.status(400).json({ error: 'Aucune ligne valide à insérer' })

      // Récupérer patients existants
      let existing
      let tursoDb = null
      if (effectiveTenant) {
        const tenant = TENANTS[effectiveTenant]
        if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
        tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        existing = (await tursoDb.execute('SELECT patient_code, first_name, last_name, dob FROM patients')).rows
      } else {
        existing = db.prepare('SELECT patient_code, first_name, last_name, dob FROM patients').all()
      }

      const existingCodes = new Set(existing.map(p => p.patient_code).filter(Boolean))
      const existingIdentities = new Set(existing.map(p => `${p.first_name}|${p.last_name}|${p.dob}`.toLowerCase()))

      const toInsert = []
      for (const p of valid) {
        const identity = `${p.first_name}|${p.last_name}|${p.dob}`.toLowerCase()
        if (p.patient_code && existingCodes.has(p.patient_code)) continue
        if (existingIdentities.has(identity)) continue
        toInsert.push(p)
      }

      if (toInsert.length === 0) {
        return res.status(400).json({ error: 'Tous les patients sont déjà présents (aucun nouveau)' })
      }

      let lastNumber = 0
      for (const code of existingCodes) {
        const m = code?.match(/^PAT-(\d+)$/)
        if (m) lastNumber = Math.max(lastNumber, parseInt(m[1]))
      }

      let inserted = 0
      const insertedList = []

      if (effectiveTenant) {
        for (const p of toInsert) {
          let code = p.patient_code
          if (!code) {
            lastNumber++
            code = `PAT-${String(lastNumber).padStart(4, '0')}`
          }
          const encNir = p.nir ? encrypt(p.nir) : null
          const encAllergies = p.allergies ? encrypt(p.allergies) : null

          await tursoDb.execute({
            sql: `INSERT INTO patients (patient_code, first_name, last_name, dob, gender, phone, address, nir, blood_type, allergies)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [code, p.first_name, p.last_name, p.dob, p.gender, p.phone, p.address, encNir, p.blood_type, encAllergies],
          })
          inserted++
          insertedList.push({ patient_code: code, first_name: p.first_name, last_name: p.last_name })
        }
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO patients (patient_code, first_name, last_name, dob, gender, phone, address, nir, blood_type, allergies)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const transaction = db.transaction((rows) => {
          for (const p of rows) {
            let code = p.patient_code
            if (!code) {
              lastNumber++
              code = `PAT-${String(lastNumber).padStart(4, '0')}`
            }
            const encNir = p.nir ? encrypt(p.nir) : null
            const encAllergies = p.allergies ? encrypt(p.allergies) : null
            insertStmt.run(code, p.first_name, p.last_name, p.dob, p.gender, p.phone, p.address, encNir, p.blood_type, encAllergies)
            inserted++
            insertedList.push({ patient_code: code, first_name: p.first_name, last_name: p.last_name })
          }
        })

        transaction(toInsert)
      }

      logAction(
        req.user.id, req.user.name, 'import', 'patients', null,
        `Import de ${inserted} patient(s) sur ${toInsert.length} ligne(s) valide(s) — tenant: ${effectiveTenant || 'local'}`
      )

      return res.json({
        success: true,
        inserted,
        skipped: valid.length - inserted,
        patients: insertedList,
      })
    } catch (err) {
      console.error('Erreur confirm import:', err)
      return res.status(500).json({ error: err.message })
    }
  })

  // ---- POST /api/admin/patients/convert ----
  // Reçoit un CSV en clair, le convertit et le chiffre
  router.post('/convert', async (req, res) => {
    const { password } = req.body
    const { tenantId } = req.user
    const file = req.file

    if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' })
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe requis (8 caractères minimum)' })
    }

    // Vérifier la permission patients.convert (admin a tout par défaut)
    const hasPermission = req.user.role === 'admin' || 
      db.prepare('SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_code = ?')
        .get(req.user.id, 'patients.convert')

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Permission patients.convert requise pour convertir un CSV' 
      })
    }

    try {
      const content = file.buffer.toString('utf-8')
      const lines = content.split('\n').filter(l => l.trim())

      if (lines.length < 2) {
        return res.status(400).json({ error: 'Le fichier CSV est vide ou invalide' })
      }

      // Détecter le séparateur (; ou ,)
      const firstLine = lines[0]
      const separator = firstLine.includes(';') ? ';' : ','

      const headers = firstLine.split(separator).map(h => h.trim())

      // Mapper les colonnes FR → EN attendues par HealthTicket
      const columnMap = {
        'Nom': 'last_name',
        'Prenom': 'first_name',
        'NumeroTelephone': 'phone',
        'DateNaissance': 'dob',
        'GroupeSanguin': 'blood_type',
        'AdressePostale': 'address',
        'NIR': 'nir',
        'Allergie': 'allergies',
        'Antecedant': null,
        'Sexe': 'gender',
        'last_name': 'last_name',
        'first_name': 'first_name',
        'phone': 'phone',
        'dob': 'dob',
        'blood_type': 'blood_type',
        'address': 'address',
        'nir': 'nir',
        'allergies': 'allergies',
        'gender': 'gender',
      }

      const targetColumns = [
        'patient_code', 'first_name', 'last_name', 'dob', 'gender',
        'phone', 'address', 'blood_type', 'nir', 'allergies',
      ]

      // Construire le CSV au bon format
      const outputLines = [targetColumns.join(',')]

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim())
        const row = {}
        headers.forEach((h, idx) => {
          const target = columnMap[h]
          if (target) row[target] = values[idx] || ''
        })

        // Normaliser le genre (M/F → M/F, sinon Autre)
        if (row.gender !== 'M' && row.gender !== 'F') {
          row.gender = 'Autre'
        }

        const csvLine = targetColumns.map(col => {
          const val = row[col] || ''
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        }).join(',')

        outputLines.push(csvLine)
      }

      const csvContent = '\uFEFF' + outputLines.join('\n')
      const csvBuffer = Buffer.from(csvContent, 'utf-8')

      // Chiffrer
      const encrypted = encryptBuffer(csvBuffer, password)

      // Journaliser
      logAction(
        req.user.id, req.user.name, 'convert', 'patients', null,
        `Conversion CSV → .enc : ${outputLines.length - 1} patients, tenant: ${tenantId || 'local'}`
      )

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `patients-convertis-${dateStr}.enc`
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('X-Patient-Count', String(outputLines.length - 1))

      return res.send(encrypted)
    } catch (err) {
      console.error('Erreur conversion CSV:', err)
      return res.status(500).json({ error: err.message })
    }
  })
  return router
}