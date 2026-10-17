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
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'technicien', 'user')),
    active INTEGER NOT NULL DEFAULT 1,
    otp_code TEXT,
    otp_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`)

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

// ==================== MIGRATIONS ====================

const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name)

if (!ticketColumns.includes('created_by')) {
  db.exec('ALTER TABLE tickets ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL')
  console.log('🔧 Migration : colonne created_by ajoutée')
}

if (!ticketColumns.includes('module_id')) {
  db.exec('ALTER TABLE tickets ADD COLUMN module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL')
  console.log('🔧 Migration : colonne module_id ajoutée')
}

if (!ticketColumns.includes('asset_id')) {
  db.exec('ALTER TABLE tickets ADD COLUMN asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL')
  console.log('🔧 Migration : colonne asset_id ajoutée')
}

if (!ticketColumns.includes('archived')) {
  db.exec('ALTER TABLE tickets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
  console.log('🔧 Migration : colonne archived ajoutée')
}

if (!ticketColumns.includes('archived_at')) {
  db.exec('ALTER TABLE tickets ADD COLUMN archived_at TEXT')
  console.log('🔧 Migration : colonne archived_at ajoutée')
}

// Initialiser les tables SLA
initSlaTables(db)

// ==================== MIGRATIONS INCIDENTS (DORA/BAIT) ====================

const ticketColumnsIncidents = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name)

if (!ticketColumnsIncidents.includes('incident_type')) {
  db.exec("ALTER TABLE tickets ADD COLUMN incident_type TEXT NOT NULL DEFAULT 'standard'")
  console.log('🔧 Migration Incidents : colonne incident_type ajoutée')
}

if (!ticketColumnsIncidents.includes('is_dora_major')) {
  db.exec('ALTER TABLE tickets ADD COLUMN is_dora_major INTEGER NOT NULL DEFAULT 0')
  console.log('🔧 Migration Incidents : colonne is_dora_major ajoutée')
}

if (!ticketColumnsIncidents.includes('dora_criteria')) {
  db.exec('ALTER TABLE tickets ADD COLUMN dora_criteria TEXT')
  console.log('🔧 Migration Incidents : colonne dora_criteria ajoutée')
}

if (!ticketColumnsIncidents.includes('dora_notification_date')) {
  db.exec('ALTER TABLE tickets ADD COLUMN dora_notification_date TEXT')
  console.log('🔧 Migration Incidents : colonne dora_notification_date ajoutée')
}

// ==================== MIGRATIONS LOGS (NIST AU-6) ====================

const logColumns = db.prepare('PRAGMA table_info(logs)').all().map(c => c.name)

if (!logColumns.includes('reviewed')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0')
  console.log('🔧 Migration Logs : colonne reviewed ajoutée')
}

if (!logColumns.includes('reviewed_by')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed_by TEXT')
  console.log('🔧 Migration Logs : colonne reviewed_by ajoutée')
}

if (!logColumns.includes('reviewed_at')) {
  db.exec('ALTER TABLE logs ADD COLUMN reviewed_at TEXT')
  console.log('🔧 Migration Logs : colonne reviewed_at ajoutée')
}

// Initialiser les tables Knowledge Base
initKnowledgeTables(db)

// Initialiser le registre GDPR
initGdprTables(db)

// ==================== SEED : Permissions ====================

const permsCount = db.prepare('SELECT COUNT(*) as c FROM permissions').get().c
if (permsCount === 0) {
  const defaultPerms = [
    ['kb.read', 'Lire la base de connaissances', 'kb', 'Accès à la base de connaissances'],
    ['kb.write', 'Créer/modifier des articles', 'kb', 'Peut écrire et modifier des articles'],
    ['kb.publish', 'Publier des articles', 'kb', 'Peut publier directement (sans validation)'],
    ['assets.write', 'Modifier les assets', 'assets', 'Peut créer/modifier les équipements'],
    ['users.manage', 'Gérer les utilisateurs', 'users', 'Peut gérer les comptes utilisateurs'],
    ['logs.view', 'Voir les logs', 'logs', 'Peut consulter le journal d\'activité'],
    ['tickets.all', 'Voir tous les tickets', 'tickets', 'Peut voir tous les tickets'],
  ]
  const insert = db.prepare('INSERT INTO permissions (code, label, module, description) VALUES (?, ?, ?, ?)')
  for (const p of defaultPerms) insert.run(...p)
  console.log('✅ Permissions par défaut créées')
}

// ==================== HELPERS ====================

function logAction(userId, userName, action, entity, entityId, details) {
  db.prepare(`
    INSERT INTO logs (user_id, user_name, action, entity, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId || null, userName || 'Système', action, entity, entityId || null, details || null)
}

// ==================== SEED : Admin & Modules ====================

const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@healthticket.local')
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, 'admin')
  `).run('Administrateur', 'admin@healthticket.local', '+237600000000', hash)
  console.log('✅ Admin par défaut créé : admin@healthticket.local / admin123')
}

const modulesExist = db.prepare('SELECT COUNT(*) as c FROM modules').get().c
if (modulesExist === 0) {
  const defaultModules = [
    ['Informatique', 'Tickets liés à l\'informatique', 'Monitor', 'blue'],
    ['Équipement médical', 'Tickets liés au matériel médical', 'HeartPulse', 'red'],
    ['Administratif', 'Tickets administratifs', 'FileText', 'slate'],
    ['Infrastructure', 'Tickets liés au bâtiment, réseau, électricité', 'Building2', 'amber'],
    ['Autre', 'Tickets divers', 'Box', 'slate'],
  ]
  const insert = db.prepare('INSERT INTO modules (name, description, icon, color) VALUES (?, ?, ?, ?)')
  for (const m of defaultModules) insert.run(...m)
  console.log('✅ Modules par défaut créés')
}

// ==================== ROUTES : AUTH & ADMIN ====================

app.use('/api/auth', createAuthRouter(db, logAction))
app.use('/api/admin', createAdminRouter(db, logAction))
app.use('/api/sla', createSlaRouter(db, logAction))
app.use('/api/kb', createKnowledgeRouter(db, logAction))
app.use('/api/gdpr', createGdprRouter(db, logAction))
app.use('/api/incidents', createIncidentsRouter(db, logAction))

// ==================== ROUTES : TICKETS ====================

app.get('/', (req, res) => {
  res.json({ message: 'API HealthTicket fonctionne !' })
})

// ---- GET /api/tickets ----
app.get('/api/tickets', authRequired, (req, res) => {
  const { archived, assigned_to } = req.query

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

  // Enrichir avec l'état SLA
  for (const t of tickets) {
    t.sla_status = computeSlaStatus(t)
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

  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'Accès refusé à ce ticket' })
  }

  ticket.sla_status = computeSlaStatus(ticket)
  res.json(ticket)
})

// ---- POST /api/tickets ----
app.post('/api/tickets', authRequired, (req, res) => {
  const { title, category, priority, description, asset_id } = req.body
  if (!title || !category || !priority) {
    return res.status(400).json({ error: 'Titre, catégorie et priorité sont obligatoires' })
  }

  if (asset_id) {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id)
    if (!asset) return res.status(400).json({ error: 'Asset introuvable' })
  }

  const result = db.prepare(`
    INSERT INTO tickets (title, category, priority, description, created_by, creator, asset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, category, priority, description || '', req.user.id, req.user.name, asset_id || null)

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
app.patch('/api/tickets/:id', authRequired, (req, res) => {
  const { status, assignee, incident_type, is_dora_major, dora_criteria, dora_notification_date } = req.body
  const targetId = parseInt(req.params.id)

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(targetId)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

  if (assignee !== undefined && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seuls les admins peuvent assigner un ticket' })
  }

  if (assignee) {
    const targetUser = db.prepare('SELECT email FROM users WHERE email = ?').get(assignee)
    if (!targetUser) return res.status(400).json({ error: 'Utilisateur assigné introuvable' })
  }

  if (incident_type && !['standard', 'security', 'major'].includes(incident_type)) {
    return res.status(400).json({ error: 'Type d\'incident invalide' })
  }

  if (is_dora_major === true && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seuls les admins peuvent classifier un incident DORA majeur' })
  }

  const previousStatus = ticket.status

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

    if (status === 'Résolu') {
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
  if (assignee !== undefined) actionDetails.push(`Assigné à : ${updated.assignee || 'Personne'}`)
  if (incident_type) actionDetails.push(`Type : ${updated.incident_type}`)
  if (is_dora_major !== undefined) actionDetails.push(`DORA majeur : ${updated.is_dora_major ? 'oui' : 'non'}`)

  logAction(req.user.id, req.user.name, 'update', 'ticket', targetId, actionDetails.join(' | '))
  res.json(updated)
})

// ---- POST /api/tickets/:id/archive ----
app.post('/api/tickets/:id/archive', authRequired, adminOnly, (req, res) => {
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

  db.prepare(`
    UPDATE tickets SET archived = 1, archived_at = datetime('now', 'localtime') WHERE id = ?
  `).run(req.params.id)

  logAction(req.user.id, req.user.name, 'archive', 'ticket', req.params.id, 'Ticket archivé')
  res.json({ success: true })
})

// ==================== ROUTES : COMMENTAIRES ====================

// ---- GET /api/tickets/:id/comments ----
app.get('/api/tickets/:id/comments', authRequired, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'Accès refusé à ce ticket' })
  }

  const comments = db.prepare(
    'SELECT * FROM comments WHERE ticket_id = ? ORDER BY id ASC'
  ).all(req.params.id)
  res.json(comments)
})

// ---- POST /api/tickets/:id/comments ----
app.post('/api/tickets/:id/comments', authRequired, (req, res) => {
  const { author, text } = req.body
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Le texte est obligatoire' })
  }

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

  if (req.user.role !== 'admin') {
    const canAccess = ticket.created_by === req.user.id || ticket.assignee === req.user.email
    if (!canAccess) return res.status(403).json({ error: 'Accès refusé à ce ticket' })
  }

  const result = db.prepare(`
    INSERT INTO comments (ticket_id, author, text) VALUES (?, ?, ?)
  `).run(req.params.id, author?.trim() || req.user.name, text.trim())

  const newComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid)
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

app.get('/api/assets/:id', authRequired, (req, res) => {
  const asset = db.prepare(`
    SELECT
      id, type, name, category, brand, model, serial_number,
      location, status, editor, version, license_count
    FROM assets
    WHERE id = ?
  `).get(req.params.id)

  if (!asset) return res.status(404).json({ error: 'Asset non trouvé' })
  res.json(asset)
})

// ==================== DÉMARRAGE ====================

const PORT = process.env.PORT || 3001
app.listen(PORT, async () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`)
  await testEmailConnection()

  try {
    logStartup(db, logAction)
  } catch (err) {
    console.error('Erreur log startup :', err)
  }

  try {
    startSlaCron(db, logAction)
  } catch (err) {
    console.error('Erreur démarrage cron SLA :', err)
  }
})