import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import { createAuthRouter, authRequired, adminOnly } from './auth.js'
import { testEmailConnection } from './email.js'
import { createAdminRouter } from './admin.js'
import { logStartup } from './version.js'
import { initSlaTables, applySlaToTicket, pauseSla, resumeSla, createSlaRouter, computeSlaStatus, PAUSE_STATUS } from './sla.js'
import { startSlaCron } from './sla-cron.js'
import { initKnowledgeTables, createKnowledgeRouter } from './knowledge.js'
import { initGdprTables, createGdprRouter } from './gdpr.js'
import { createIncidentsRouter } from './incidents.js'
import {
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyNewComment,
  getPreferences,
  updatePreferences,
} from './notifications.js'
import { initCatalogTables, createCatalogRouter } from './catalog.js'
import { initChangeTables, createChangeRouter } from './changes.js'
import { encrypt, decrypt, getEncryptionStatus } from './encryption.js'
import { initCmdbTables, createCmdbRouter } from './cmdb.js'
import { createPortalRouter } from './portal.js'
import { initProblemTables, createProblemRouter } from './problems.js'
import { initSupplierTables, createSupplierRouter } from './suppliers.js'
import { initRiskTables, createRiskRouter } from './risks.js'
import { initFacilityTables, createFacilityRouter } from './facility.js'
import { initResourceTables, createResourceRouter, startResourcesCron } from './resources.js'
import { initPatientTables, createPatientRouter } from './patients.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

const app = express()
const db = new Database('tickets.db')
db.pragma('foreign_keys = ON')

app.use(cors())
app.use(express.json())

// ==================== TABLES ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    active INTEGER NOT NULL DEFAULT 1,
    otp_code TEXT,
    otp_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`)

// === MIGRATION : AJOUT D'UN RÃ”LE PERSONNALISÃ‰ (SANS TOUCHER Ã€ LA TABLE EXISTANTE) ===
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name)

if (!userColumns.includes('custom_role')) {
  db.exec("ALTER TABLE users ADD COLUMN custom_role TEXT")
  console.log('ðŸ”§ Migration : colonne custom_role ajoutÃ©e')
}

db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Box',
    color TEXT DEFAULT 'slate',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('hardware', 'software')),
    name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    location TEXT,
    assigned_to INTEGER,
    status TEXT NOT NULL DEFAULT 'En service',
    purchase_date TEXT,
    warranty_end TEXT,
    editor TEXT,
    version TEXT,
    license_key TEXT,
    license_expires_at TEXT,
    license_count INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ouvert',
    description TEXT,
    assignee TEXT DEFAULT '-',
    creator TEXT DEFAULT 'Utilisateur',
    created_by INTEGER,
    module_id INTEGER,
    asset_id INTEGER,
    archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT 'Utilisateur',
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS asset_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    uploaded_by INTEGER,
    uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`)

// ==================== TABLES PERMISSIONS ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    granted_by_id INTEGER,
    granted_by_name TEXT,
    granted_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, permission_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ==================== TABLES RÃ”LES DYNAMIQUES ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
  );
  
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
  );
`)

// CrÃ©er les rÃ´les par dÃ©faut s'ils n'existent pas
const rolesCount = db.prepare('SELECT COUNT(*) as c FROM roles').get().c
if (rolesCount === 0) {
  const defaultRoles = [
    ['Admin', 'AccÃ¨s complet Ã  toutes les fonctionnalitÃ©s'],
    ['Technicien', 'AccÃ¨s Ã  la gestion des tickets et des assets'],
    ['Utilisateur', 'AccÃ¨s basique au portail et Ã  ses tickets']
  ]
  const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)')
  for (const r of defaultRoles) insertRole.run(...r)
  console.log('âœ… RÃ´les par dÃ©faut crÃ©Ã©s')
}

// ==================== TABLES RÃ”LES DYNAMIQUES ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
  );
  
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
  );
`)

const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name)

if (!ticketColumns.includes('created_by')) {
  db.exec('ALTER TABLE tickets ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL')
  console.log('ðŸ”§ Migration : colonne created_by ajoutÃ©e')
}

if (!ticketColumns.includes('module_id')) {
  db.exec('ALTER TABLE tickets ADD COLUMN module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL')
  console.log('ðŸ”§ Migration : colonne module_id ajoutÃ©e')
}

if (!ticketColumns.includes('asset_id')) {
  db.exec('ALTER TABLE tickets ADD COLUMN asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL')
  console.log('ðŸ”§ Migration : colonne asset_id ajoutÃ©e')
}

if (!ticketColumns.includes('archived')) {
  db.exec('ALTER TABLE tickets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
  console.log('ðŸ”§ Migration : colonne archived ajoutÃ©e')
}

if (!ticketColumns.includes('archived_at')) {
  db.exec('ALTER TABLE tickets ADD COLUMN archived_at TEXT')
  console.log('ðŸ”§ Migration : colonne archived_at ajoutÃ©e')
}

// Initialiser les tables SLA
initSlaTables(db)

// Migration : ajout du numÃ©ro d'identification unique (asset_tag)
if (!ticketColumns.includes('asset_tag')) {
  // On ajoute la colonne sur la table ASSETS (attention, on utilise assets, pas tickets)
}
// Il faut d'abord rÃ©cupÃ©rer les colonnes de la table assets
const assetColumns = db.prepare("PRAGMA table_info(assets)").all().map(c => c.name)
if (!assetColumns.includes('asset_tag')) {
  db.exec('ALTER TABLE assets ADD COLUMN asset_tag TEXT')
  console.log('ðŸ”§ Migration : colonne asset_tag ajoutÃ©e')
}
if (!assetColumns.includes('room_id')) {
  db.exec('ALTER TABLE assets ADD COLUMN room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL')
  console.log('ðŸ”§ Migration : colonne room_id ajoutÃ©e Ã  la table assets')
}

// ==================== MIGRATIONS INCIDENTS (DORA/BAIT) ====================

const ticketColumnsIncidents = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name)

if (!ticketColumnsIncidents.includes('incident_type')) {
  db.exec("ALTER TABLE tickets ADD COLUMN incident_type TEXT NOT NULL DEFAULT 'standard'")
  console.log('ðŸ”§ Migration Incidents : colonne incident_type ajoutÃ©e')
}

if (!ticketColumnsIncidents.includes('is_dora_major')) {
  db.exec('ALTER TABLE tickets ADD COLUMN is_dora_major INTEGER NOT NULL DEFAULT 0')
  console.log('ðŸ”§ Migration Incidents : colonne is_dora_major ajoutÃ©e')
}

if (!ticketColumnsIncidents.includes('dora_criteria')) {
  db.exec('ALTER TABLE tickets ADD COLUMN dora_criteria TEXT')
  console.log('ðŸ”§ Migration Incidents : colonne dora_criteria ajoutÃ©e')
}

if (!ticketColumnsIncidents.includes('dora_notification_date')) {
  db.exec('ALTER TABLE tickets ADD COLUMN dora_notification_date TEXT')
  console.log('ðŸ”§ Migration Incidents : colonne dora_notification_date ajoutÃ©e')
}

// ==================== MIGRATIONS LOGS (NIST AU-6) ====================

const logColumns = db.prepare('PRAGMA table_info(logs)').all().map(c => c.name)

if (!logColumns.includes('reviewed')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0')
  console.log('ðŸ”§ Migration Logs : colonne reviewed ajoutÃ©e')
}

if (!logColumns.includes('reviewed_by')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed_by TEXT')
  console.log('ðŸ”§ Migration Logs : colonne reviewed_by ajoutÃ©e')
}

if (!logColumns.includes('reviewed_at')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed_at TEXT')
  console.log('ðŸ”§ Migration Logs : colonne reviewed_at ajoutÃ©e')
}

// Initialiser les tables Knowledge Base
initKnowledgeTables(db)

// Initialiser le registre GDPR
initGdprTables(db)

// Initialiser les tables CMDB
initCmdbTables(db)

// Initialiser les tables ProblÃ¨mes
initProblemTables(db)

// Initialiser les tables Risk
initRiskTables(db)

// Initialiser les tables FacilityTables
initFacilityTables(db)

// Initialiser les tables Resource
initResourceTables(db)

// Initialiser les tables Patients
initPatientTables(db)

// ==================== SEED : Permissions ====================

const permsCount = db.prepare('SELECT COUNT(*) as c FROM permissions').get().c
if (permsCount === 0) {
  const defaultPerms = [
    ['kb.read', 'Lire la base de connaissances', 'kb', 'AccÃ¨s Ã  la base de connaissances'],
    ['kb.write', 'CrÃ©er/modifier des articles', 'kb', 'Peut Ã©crire et modifier des articles'],
    ['kb.publish', 'Publier des articles', 'kb', 'Peut publier directement (sans validation)'],
    ['assets.write', 'Modifier les assets', 'assets', 'Peut crÃ©er/modifier les Ã©quipements'],
    ['users.manage', 'GÃ©rer les utilisateurs', 'users', 'Peut gÃ©rer les comptes utilisateurs'],
    ['logs.view', 'Voir les logs', 'logs', 'Peut consulter le journal d\'activitÃ©'],
    ['tickets.all', 'Voir tous les tickets', 'tickets', 'Peut voir tous les tickets'],
    ['medical.read', 'Voir les donnÃ©es patients', 'medical', 'Peut voir et saisir les informations mÃ©dicales (patients)'],
  ]

  const insert = db.prepare('INSERT INTO permissions (code, label, module, description) VALUES (?, ?, ?, ?)')
  for (const p of defaultPerms) insert.run(...p)
  console.log('âœ… Permissions par dÃ©faut crÃ©Ã©es')
}

// ==================== HELPERS ====================

function logAction(userId, userName, action, entity, entityId, details) {
  db.prepare(`
    INSERT INTO logs (user_id, user_name, action, entity, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId || null, userName || 'SystÃ¨me', action, entity, entityId || null, details || null)
}

// ==================== SEED : Admin & Modules ====================

const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@healthticket.local')
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, 'admin')
  `).run('Administrateur', 'admin@healthticket.local', '+237600000000', hash)
  console.log('âœ… Admin par dÃ©faut crÃ©Ã© : admin@healthticket.local / admin123')
}

const modulesExist = db.prepare('SELECT COUNT(*) as c FROM modules').get().c
if (modulesExist === 0) {
  const defaultModules = [
    ['Informatique', 'Tickets liÃ©s Ã  l\'informatique', 'Monitor', 'blue'],
    ['Ã‰quipement mÃ©dical', 'Tickets liÃ©s au matÃ©riel mÃ©dical', 'HeartPulse', 'red'],
    ['Administratif', 'Tickets administratifs', 'FileText', 'slate'],
    ['Infrastructure', 'Tickets liÃ©s au bÃ¢timent, rÃ©seau, Ã©lectricitÃ©', 'Building2', 'amber'],
    ['Autre', 'Tickets divers', 'Box', 'slate'],
  ]
  const insert = db.prepare('INSERT INTO modules (name, description, icon, color) VALUES (?, ?, ?, ?)')
  for (const m of defaultModules) insert.run(...m)
  console.log('âœ… Modules par dÃ©faut crÃ©Ã©s')
}

// ==================== ROUTES : AUTH & ADMIN ====================

app.use('/api/auth', createAuthRouter(db, logAction))
app.use('/api/admin', createAdminRouter(db, logAction))
app.use('/api/sla', createSlaRouter(db, logAction))
app.use('/api/kb', createKnowledgeRouter(db, logAction))
app.use('/api/gdpr', createGdprRouter(db, logAction))
app.use('/api/incidents', createIncidentsRouter(db, logAction))
app.use('/api/cmdb', createCmdbRouter(db, logAction))
app.use('/api/portal', createPortalRouter(db, logAction))
app.use('/api/problems', createProblemRouter(db, logAction))
app.use('/api/catalog', createCatalogRouter(db, logAction))
app.use('/api/changes', createChangeRouter(db, logAction))
app.use('/api/suppliers', createSupplierRouter(db, logAction))
app.use('/api/risks', createRiskRouter(db, logAction))
app.use('/api/facility', createFacilityRouter(db, logAction))
app.use('/api/resources', createResourceRouter(db, logAction))
app.use('/api/patients', createPatientRouter(db, logAction))

// ==================== ROUTES : PRÃ‰FÃ‰RENCES NOTIFICATIONS ====================

// Initialiser le catalogue
initCatalogTables(db)
initChangeTables(db)
initSupplierTables(db)

app.get('/api/notifications/preferences', authRequired, (req, res) => {
  try {
    const prefs = getPreferences(db, req.user.id)
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/notifications/preferences', authRequired, (req, res) => {
  try {
    const updated = updatePreferences(db, req.user.id, req.body)
    logAction(req.user.id, req.user.name, 'update', 'notification_prefs', req.user.id, 'PrÃ©fÃ©rences mises Ã  jour')
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==================== ROUTES : TICKETS ====================

app.get('/', (req, res) => {
  res.json({ message: 'API HealthTicket fonctionne !' })
})

// ---- GET /api/security/encryption-status ----
app.get('/api/security/encryption-status', authRequired, (req, res) => {
  res.json(getEncryptionStatus())
})

// ---- GET /api/tickets ----
app.get('/api/tickets', authRequired, async (req, res) => {
  const { archived, assigned_to } = req.query
  const { tenantId } = req.user

  // --- MODE TURSO (Multi-tenant) ---
  if (tenantId) {
    const tenant = TENANTS[tenantId]
    if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })

    const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
    
    try {
      let query = `
        SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
        FROM tickets t
        LEFT JOIN users u ON t.assignee = u.email
        WHERE 1=1
      `
      const args = []

      query += archived === 'true' ? ' AND t.archived = 1' : ' AND t.archived = 0'

      if (req.user.role === 'admin') {
        // Admin : voit tout
      } else if (req.user.role === 'technicien') {
        query += ` AND (t.assignee = ? OR t.created_by = ?)`
        args.push(req.user.email, req.user.id)
      } else {
        query += ` AND (t.created_by = ? OR t.assignee = ?)`
        args.push(req.user.id, req.user.email)
      }

      if (assigned_to) {
        query += ' AND t.assignee = ?'
        args.push(assigned_to)
      }

      query += ' ORDER BY t.id DESC'

      const result = await tursoDb.execute({ sql: query, args })
      const tickets = result.rows

      for (const t of tickets) {
        t.sla_status = computeSlaStatus(t)
        t.description = decrypt(t.description)
      }

      return res.json(tickets)
    } catch (err) {
      console.error('Erreur Turso tickets:', err)
      return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
    }
  }

  // --- MODE SQLITE (votre code actuel) ---
  let query = `
    SELECT t.*, u.name as assigned_to_name, u.email as assigned_to_email
    FROM tickets t
    LEFT JOIN users u ON t.assignee = u.email
    WHERE 1=1
  `
  const params = []

  query += archived === 'true' ? ' AND t.archived = 1' : ' AND t.archived = 0'

  if (req.user.role === 'admin') {
    // Admin : voit tout
  } else if (req.user.role === 'technicien') {
    query += ` AND (t.assignee = ? OR t.created_by = ?)`
    params.push(req.user.email, req.user.id)
  } else {
    query += ` AND (t.created_by = ? OR t.assignee = ?)`
    params.push(req.user.id, req.user.email)
  }

  if (assigned_to) {
    query += ' AND t.assignee = ?'
    params.push(assigned_to)
  }

  query += ' ORDER BY t.id DESC'

  const tickets = db.prepare(query).all(...params)

  for (const t of tickets) {
    t.sla_status = computeSlaStatus(t)
    t.description = decrypt(t.description)
  }

  res.json(tickets)
})

// ---- GET /api/tickets/:id ----
app.get('/api/tickets/:id', authRequired, (req, res) => {
  const ticket = db.prepare(`
    SELECT
      t.*,
      u.name as assigned_to_name,
      a.type as asset_type,
      a.name as asset_name,
      a.serial_number as asset_serial_number,
      a.brand as asset_brand,
      a.model as asset_model,
      a.editor as asset_editor,
      a.version as asset_version,
      a.category as asset_category,
      a.location as asset_location
    FROM tickets t
    LEFT JOIN users u ON t.assignee = u.email
    LEFT JOIN assets a ON t.asset_id = a.id
    WHERE t.id = ?
  `).get(req.params.id)

  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvÃ©' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'AccÃ¨s refusÃ© Ã  ce ticket' })
  }

// DÃ©chiffrer la description
ticket.description = decrypt(ticket.description)

ticket.sla_status = computeSlaStatus(ticket)
res.json(ticket)
})

// ---- POST /api/tickets ----
app.post('/api/tickets', authRequired, async (req, res) => {
  const { title, category, priority, description, asset_id } = req.body
  const { tenantId } = req.user

  if (!title || !category || !priority) {
    return res.status(400).json({ error: 'Titre, catégorie et priorité sont obligatoires' })
  }

  const encryptedDescription = description ? encrypt(description) : null

  // --- MODE TURSO (Multi-tenant) ---
  if (tenantId) {
    const tenant = TENANTS[tenantId]
    if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })

    const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

    try {
      // Vérification asset (optionnelle, à adapter)
      // if (asset_id) { ... }

      const result = await tursoDb.execute({
        sql: `
          INSERT INTO tickets (title, category, priority, description, created_by, creator, asset_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [title, category, priority, encryptedDescription, req.user.id, req.user.name, asset_id || null]
      })

      const newTicketResult = await tursoDb.execute({
        sql: `
          SELECT t.*, u.name as assigned_to_name
          FROM tickets t
          LEFT JOIN users u ON t.assignee = u.email
          WHERE t.id = ?
        `,
        args: [result.lastInsertRowid]
      })
      const newTicket = newTicketResult.rows[0]

      // Appliquer SLA (il faudrait adapter applySlaToTicket pour Turso, on le fera plus tard)
      // applySlaToTicket(tursoDb, result.lastInsertRowid, priority)

      newTicket.sla_status = computeSlaStatus(newTicket)
      logAction(req.user.id, req.user.name, 'create', 'ticket', newTicket.id, `Ticket créé : ${newTicket.title}`)
      
      return res.status(201).json(newTicket)
    } catch (err) {
      console.error('Erreur Turso POST ticket:', err)
      return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
    }
  }

  // --- MODE SQLITE (votre code actuel) ---
  if (asset_id) {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id)
    if (!asset) return res.status(400).json({ error: 'Asset introuvable' })
  }

  const result = db.prepare(`
    INSERT INTO tickets (title, category, priority, description, created_by, creator, asset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, category, priority, encryptedDescription, req.user.id, req.user.name, asset_id || null)

  applySlaToTicket(db, result.lastInsertRowid, priority)

  const newTicket = db.prepare(`
    SELECT t.*, u.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON t.assignee = u.email
    WHERE t.id = ?
  `).get(result.lastInsertRowid)

  newTicket.sla_status = computeSlaStatus(newTicket)
  logAction(req.user.id, req.user.name, 'create', 'ticket', newTicket.id, `Ticket créé : ${newTicket.title}`)
  res.status(201).json(newTicket)
})

// ---- PATCH /api/tickets/:id ----
app.patch('/api/tickets/:id', authRequired, async (req, res) => {
  const { status, assignee, incident_type, is_dora_major, dora_criteria, dora_notification_date } = req.body
  const targetId = parseInt(req.params.id)

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(targetId)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvÃ©' })

  if (assignee !== undefined && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seuls les admins peuvent assigner un ticket' })
  }

  if (assignee) {
    const targetUser = db.prepare('SELECT email FROM users WHERE email = ?').get(assignee)
    if (!targetUser) return res.status(400).json({ error: 'Utilisateur assignÃ© introuvable' })
  }

  if (incident_type && !['standard', 'security', 'major'].includes(incident_type)) {
    return res.status(400).json({ error: 'Type d\'incident invalide' })
  }

  if (is_dora_major === true && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seuls les admins peuvent classifier un incident DORA majeur' })
  }

  const previousStatus = ticket.status
  const previousAssignee = ticket.assignee

  db.prepare(`
    UPDATE tickets
    SET status = COALESCE(?, status),
        assignee = CASE WHEN ? IS NULL THEN assignee ELSE ? END,
        incident_type = COALESCE(?, incident_type),
        is_dora_major = COALESCE(?, is_dora_major),
        dora_criteria = COALESCE(?, dora_criteria),
        dora_notification_date = COALESCE(?, dora_notification_date)
    WHERE id = ?
  `).run(
    status || null,
    assignee === undefined ? null : assignee,
    assignee === undefined ? null : (assignee || '-'),
    incident_type || null,
    is_dora_major !== undefined ? (is_dora_major ? 1 : 0) : null,
    dora_criteria !== undefined ? (typeof dora_criteria === 'string' ? dora_criteria : JSON.stringify(dora_criteria)) : null,
    dora_notification_date || null,
    targetId
  )

  // Gestion SLA pause/relance
  if (status && status !== previousStatus) {
    if (status === PAUSE_STATUS) {
      pauseSla(db, targetId)
    } else if (previousStatus === PAUSE_STATUS) {
      resumeSla(db, targetId)
    }

    if (status === 'RÃ©solu') {
      db.prepare('UPDATE tickets SET resolved_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(targetId)
    }
  }

  const updated = db.prepare(`
    SELECT t.*, u.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON t.assignee = u.email
    WHERE t.id = ?
  `).get(targetId)

  updated.sla_status = computeSlaStatus(updated)

  const actionDetails = []
  if (status) actionDetails.push(`Statut : ${updated.status}`)
  if (assignee !== undefined) actionDetails.push(`AssignÃ© Ã  : ${updated.assignee || 'Personne'}`)
  if (incident_type) actionDetails.push(`Type : ${updated.incident_type}`)
  if (is_dora_major !== undefined) actionDetails.push(`DORA majeur : ${updated.is_dora_major ? 'oui' : 'non'}`)

  logAction(req.user.id, req.user.name, 'update', 'ticket', targetId, actionDetails.join(' | '))

// ==================== NOTIFICATIONS ====================

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

try {
  // 1. Notification assignation
  if (assignee !== undefined && assignee && assignee !== '-' && assignee !== previousAssignee) {
    await notifyTicketAssigned(db, updated, assignee, frontendUrl)
  }

  // 2. Notification changement de statut
  if (status && status !== previousStatus) {
    await notifyStatusChanged(db, updated, previousStatus, status, frontendUrl)
  }
} catch (err) {
  console.error('Erreur notification:', err)
}

res.json(updated)
})

// ---- POST /api/tickets/:id/archive ----
app.post('/api/tickets/:id/archive', authRequired, adminOnly, (req, res) => {
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvÃ©' })

  db.prepare(`
    UPDATE tickets SET archived = 1, archived_at = datetime('now', 'localtime') WHERE id = ?
  `).run(req.params.id)

  logAction(req.user.id, req.user.name, 'archive', 'ticket', req.params.id, 'Ticket archivÃ©')
  res.json({ success: true })
})

// ==================== ROUTES : COMMENTAIRES ====================

// ---- GET /api/tickets/:id/comments ----
app.get('/api/tickets/:id/comments', authRequired, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvÃ©' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'AccÃ¨s refusÃ© Ã  ce ticket' })
  }

  const comments = db.prepare(
    'SELECT * FROM comments WHERE ticket_id = ? ORDER BY id ASC'
  ).all(req.params.id)
  res.json(comments)
})

// ---- POST /api/tickets/:id/comments ----
app.post('/api/tickets/:id/comments', authRequired, async (req, res) => {
  const { author, text } = req.body
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Le texte est obligatoire' })
  }

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvÃ©' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'AccÃ¨s refusÃ© Ã  ce ticket' })
  }

  const result = db.prepare(`
  INSERT INTO comments (ticket_id, author, text) VALUES (?, ?, ?)
`).run(req.params.id, author?.trim() || req.user.name, text.trim())

const newComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid)

// ==================== NOTIFICATION COMMENTAIRE ====================

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

try {
  await notifyNewComment(db, ticket, newComment, req.user.id, req.user.name, frontendUrl)
} catch (err) {
  console.error('Erreur notification commentaire:', err)
}

res.status(201).json(newComment)
})

// ==================== ROUTES : ASSETS (public) ====================

app.get('/api/assets', authRequired, (req, res) => {
  const { type, module_name } = req.query

  let query = `
    SELECT
      id, type, name, category, brand, model, serial_number,
      location, status, editor, version, license_count
    FROM assets
    WHERE 1=1
  `
  const params = []

  if (type && ['hardware', 'software'].includes(type)) {
    query += ' AND type = ?'
    params.push(type)
  }

  if (module_name) {
    query += ' AND (category LIKE ? OR name LIKE ?)'
    const search = `%${module_name}%`
    params.push(search, search)
  }

  query += ' ORDER BY type ASC, name ASC'

  const assets = db.prepare(query).all(...params)
  res.json(assets)
})

// ---- GET /api/assets/full ----
// Liste enrichie des assets avec infos CI associÃ©s
app.get('/api/assets/full', authRequired, (req, res) => {
  const { type, search } = req.query

  let query = `
    SELECT
      a.id, a.type, a.name, a.category, a.brand, a.model,
      a.serial_number, a.location, a.status,
      a.editor, a.version, a.license_count,
      a.assigned_to,
      u.name as assigned_to_name,
      c.id as ci_id,
      c.name as ci_name,
      c.code as ci_code,
      c.type as ci_type,
      c.criticality as ci_criticality,
      c.status as ci_status
    FROM assets a
    LEFT JOIN users u ON a.assigned_to = u.id
    LEFT JOIN configuration_items c ON (
      c.name = a.name OR c.code = a.serial_number
    )
    WHERE 1=1
  `
  const params = []

  if (type && ['hardware', 'software'].includes(type)) {
    query += ' AND a.type = ?'
    params.push(type)
  }

  if (search) {
    query += ' AND (a.name LIKE ? OR a.serial_number LIKE ? OR a.brand LIKE ? OR a.model LIKE ? OR a.editor LIKE ?)'
    const s = `%${search}%`
    params.push(s, s, s, s, s)
  }

  query += ' ORDER BY a.type ASC, a.name ASC LIMIT 200'

  const assets = db.prepare(query).all(...params)
  res.json(assets)
})

// ---- GET /api/assets/:id ----
app.get('/api/assets/:id', authRequired, (req, res) => {
  const asset = db.prepare(`
    SELECT
      id, type, name, category, brand, model, serial_number,
      location, status, editor, version, license_count
    FROM assets
    WHERE id = ?
  `).get(req.params.id)

  if (!asset) return res.status(404).json({ error: 'Asset non trouvÃ©' })
  res.json(asset)
})

// ==================== ROUTES : STATISTIQUES (DASHBOARD CAPACITÃ‰) ====================

app.get('/api/stats/capacity', authRequired, adminOnly, (req, res) => {
  try {
    // 1. Charge par technicien (nombre de tickets assignÃ©s)
    const workload = db.prepare(`
      SELECT assignee, COUNT(*) as ticket_count 
      FROM tickets 
      WHERE archived = 0 AND assignee != '-' AND assignee IS NOT NULL
      GROUP BY assignee
      ORDER BY ticket_count DESC
    `).all()

    // 2. RÃ©partition par statut
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tickets 
      WHERE archived = 0
      GROUP BY status
    `).all()

    // 3. RÃ©partition par prioritÃ©
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tickets 
      WHERE archived = 0
      GROUP BY priority
    `).all()

    // 4. Tickets rÃ©solus (pour calcul MTTR et SLA)
        const resolvedTickets = db.prepare(`
      SELECT id, priority, status, created_at, resolved_at 
      FROM tickets 
      WHERE status = 'RÃ©solu' AND archived = 0 AND resolved_at IS NOT NULL
    `).all()

    // Calcul du MTTR (en heures)
    let totalHours = 0
    let validCount = 0
    for (const t of resolvedTickets) {
      const created = new Date(t.created_at).getTime()
      const resolved = new Date(t.resolved_at).getTime()
      if (resolved > created) {
        totalHours += (resolved - created) / (1000 * 60 * 60)
        validCount++
      }
    }
    const mttr = validCount > 0 ? (totalHours / validCount).toFixed(1) : 0

    // ConformitÃ© SLA (simplifiÃ©e sur la base des tickets rÃ©solus)
    const totalTickets = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE archived = 0').get().c
        // Calcul de la conformitÃ© SLA (on rÃ©cupÃ¨re les tickets et on calcule le statut)
    const allActiveTickets = db.prepare("SELECT * FROM tickets WHERE archived = 0").all()
    let exceededSla = 0
    for (const t of allActiveTickets) {
      if (computeSlaStatus(t) === 'dÃ©passÃ©') {
        exceededSla++
      }
    }
    const slaCompliance = totalTickets > 0 ? (((totalTickets - exceededSla) / totalTickets) * 100).toFixed(1) : 100

    res.json({
      workload,
      byStatus,
      byPriority,
      mttr: parseFloat(mttr),
      slaCompliance: parseFloat(slaCompliance),
      totalTickets
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==================== ROUTES : STATISTIQUES (DASHBOARD CAPACITÃ‰) ====================

app.get('/api/stats/capacity', authRequired, adminOnly, (req, res) => {
  try {
    const workload = db.prepare(`
      SELECT assignee, COUNT(*) as ticket_count 
      FROM tickets 
      WHERE archived = 0 AND assignee != '-' AND assignee IS NOT NULL
      GROUP BY assignee
      ORDER BY ticket_count DESC
    `).all()

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tickets 
      WHERE archived = 0
      GROUP BY status
    `).all()

    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tickets 
      WHERE archived = 0
      GROUP BY priority
    `).all()

    const resolvedTickets = db.prepare(`
      SELECT id, priority, status, created_at, resolved_at 
      FROM tickets 
      WHERE status = 'RÃ©solu' AND archived = 0 AND resolved_at IS NOT NULL
    `).all()

    let totalHours = 0
    let validCount = 0
    for (const t of resolvedTickets) {
      const created = new Date(t.created_at).getTime()
      const resolved = new Date(t.resolved_at).getTime()
      if (resolved > created) {
        totalHours += (resolved - created) / (1000 * 60 * 60)
        validCount++
      }
    }
    const mttr = validCount > 0 ? (totalHours / validCount).toFixed(1) : 0

    // Calcul de la conformitÃ© SLA (SANS requÃªte SQL sur sla_status)
    const allActiveTickets = db.prepare("SELECT * FROM tickets WHERE archived = 0").all()
    let exceededSla = 0
    for (const t of allActiveTickets) {
      if (computeSlaStatus(t) === 'dÃ©passÃ©') {
        exceededSla++
      }
    }

    const totalTickets = allActiveTickets.length
    const slaCompliance = totalTickets > 0 ? (((totalTickets - exceededSla) / totalTickets) * 100).toFixed(1) : 100

    res.json({
      workload,
      byStatus,
      byPriority,
      mttr: parseFloat(mttr),
      slaCompliance: parseFloat(slaCompliance),
      totalTickets
    })
  } catch (err) {
    console.error("Erreur API CapacitÃ©:", err)
    res.status(500).json({ error: err.message })
  }
})


// ==================== ROUTES : RÃ”LES DYNAMIQUES ====================

app.get('/api/admin/roles', authRequired, adminOnly, (req, res) => {
  const roles = db.prepare(`
    SELECT r.*, 
    (SELECT COUNT(*) FROM users u WHERE u.role = r.name) as user_count,
    (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
    FROM roles r ORDER BY r.name ASC
  `).all()
  res.json(roles)
})

app.post('/api/admin/roles', authRequired, adminOnly, (req, res) => {
  const { name, description } = req.body
  try {
    const result = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name, description)
    logAction(req.user.id, req.user.name, 'create', 'role', result.lastInsertRowid, `RÃ´le crÃ©Ã© : ${name}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  } catch (err) {
    res.status(400).json({ error: 'Ce rÃ´le existe dÃ©jÃ ' })
  }
})

app.get('/api/admin/roles/:id/permissions', authRequired, adminOnly, (req, res) => {
  const perms = db.prepare('SELECT permission_code FROM role_permissions WHERE role_id = ?').all(req.params.id)
  res.json(perms.map(p => p.permission_code))
})

app.post('/api/admin/roles/:id/permissions', authRequired, adminOnly, (req, res) => {
  const { permission_code } = req.body
  try {
    db.prepare('INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)').run(req.params.id, permission_code)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: 'Permission dÃ©jÃ  accordÃ©e' })
  }
})

app.delete('/api/admin/roles/:id/permissions/:code', authRequired, adminOnly, (req, res) => {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_code = ?').run(req.params.id, req.params.code)
  res.json({ success: true })
})

// ==================== ROUTES : RÔLES DYNAMIQUES ====================

// GET /api/admin/roles
app.get('/api/admin/roles', authRequired, adminOnly, (req, res) => {
  const roles = db.prepare(`
    SELECT r.*, 
    (SELECT COUNT(*) FROM users u WHERE u.custom_role = r.name) as user_count,
    (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
    FROM roles r ORDER BY r.name ASC
  `).all()
  res.json(roles)
})

// POST /api/admin/roles
app.post('/api/admin/roles', authRequired, adminOnly, (req, res) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' })
  try {
    const result = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name, description || null)
    logAction(req.user.id, req.user.name, 'create', 'role', result.lastInsertRowid, `Rôle créé : ${name}`)
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce rôle existe déjà' })
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/roles/:id/permissions
app.get('/api/admin/roles/:id/permissions', authRequired, adminOnly, (req, res) => {
  const perms = db.prepare('SELECT permission_code FROM role_permissions WHERE role_id = ?').all(req.params.id)
  res.json(perms.map(p => p.permission_code))
})

// POST /api/admin/roles/:id/permissions
app.post('/api/admin/roles/:id/permissions', authRequired, adminOnly, (req, res) => {
  const { permission_code } = req.body
  try {
    db.prepare('INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)').run(req.params.id, permission_code)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: 'Permission déjà accordée' })
  }
})

// DELETE /api/admin/roles/:id/permissions/:code
app.delete('/api/admin/roles/:id/permissions/:code', authRequired, adminOnly, (req, res) => {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_code = ?').run(req.params.id, req.params.code)
  res.json({ success: true })
})

// ==================== DÃ‰MARRAGE ====================

const PORT = process.env.PORT || 3001
app.listen(PORT, async () => {
  console.log(`Serveur backend dÃ©marrÃ© sur http://localhost:${PORT}`)
  await testEmailConnection()

  try {
    logStartup(db, logAction)
  } catch (err) {
    console.error('Erreur log startup :', err)
  }

  try {
    startSlaCron(db, logAction)
  } catch (err) {
    console.error('Erreur dÃ©marrage cron SLA :', err)
  }

  try {
    startSlaCron(db, logAction)
  } catch (err) {
    console.error('Erreur dÃ©marrage cron SLA :', err)
  }

  // AJOUTE CES LIGNES :
  try {
    startResourcesCron(db, logAction)
  } catch (err) {
    console.error('Erreur dÃ©marrage cron Ressources :', err)
  }
})


