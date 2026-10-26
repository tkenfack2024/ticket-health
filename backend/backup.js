import fs from 'fs'
import path from 'path'
import cron from 'node-cron'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'

// 📁 Dossier où seront stockés les backups
const BACKUP_DIR = path.join(process.cwd(), 'backups')
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// ==================== INITIALISATION DES TABLES ====================
export function initBackupTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      interval_hours INTEGER NOT NULL DEFAULT 24,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_backup_at TEXT,
      last_backup_status TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)
  db.exec(`INSERT OR IGNORE INTO backup_config (id) VALUES (1)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      filepath TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'auto',
      tenant_id TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_by INTEGER,
      created_by_name TEXT
    )
  `)
  console.log('✅ Tables de sauvegarde initialisées')
}

// ==================== CONFIGURATION ====================
export function getBackupConfig(db) {
  return db.prepare('SELECT * FROM backup_config WHERE id = 1').get()
}

export function updateBackupConfig(db, { interval_hours, enabled }) {
  db.prepare(`
    UPDATE backup_config SET
      interval_hours = COALESCE(?, interval_hours),
      enabled = COALESCE(?, enabled),
      updated_at = datetime('now', 'localtime')
    WHERE id = 1
  `).run(interval_hours || null, enabled !== undefined ? (enabled ? 1 : 0) : null)
  return getBackupConfig(db)
}

// ==================== CRÉATION D'UN BACKUP ====================
export async function createBackup(db, { type = 'auto', tenantId = null, user = null } = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = tenantId 
    ? `backup-${tenantId}-${timestamp}.sql` 
    : `backup-local-${timestamp}.db`
  const filepath = path.join(BACKUP_DIR, filename)

  try {
    if (tenantId) {
      // 🟢 BACKUP TURSO (Dump SQL basique)
      const tenant = TENANTS[tenantId]
      if (!tenant) throw new Error('Tenant introuvable')
      
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      // Requête basique pour simuler un dump (en V1 on sauvegarde les tables principales)
      // Pour un vrai dump complet, il faudrait boucler sur toutes les tables.
      const tables = ['users', 'tickets', 'patients', 'medical_records', 'comments']
      let sqlDump = `-- Backup ${tenantId} - ${timestamp}\n\n`
      
      for (const table of tables) {
        const res = await tursoDb.execute(`SELECT * FROM ${table}`)
        if (res.rows.length > 0) {
          sqlDump += `-- Données de la table ${table}\n`
          // On génère des requêtes INSERT simples (attention: les BLOB ne sont pas gérés ici en V1)
          for (const row of res.rows) {
             const keys = Object.keys(row).join(', ')
             const values = Object.values(row).map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')
             sqlDump += `INSERT INTO ${table} (${keys}) VALUES (${values});\n`
          }
        }
      }
      fs.writeFileSync(filepath, sqlDump, 'utf-8')
    } else {
      // 🟢 BACKUP SQLITE LOCAL
      if (fs.existsSync('tickets.db')) {
        fs.copyFileSync('tickets.db', filepath)
      } else {
        throw new Error('Fichier tickets.db introuvable')
      }
    }

    const stats = fs.statSync(filepath)
    const result = db.prepare(`
      INSERT INTO backups (filename, filepath, size_bytes, type, tenant_id, status, created_by, created_by_name)
      VALUES (?, ?, ?, ?, ?, 'success', ?, ?)
    `).run(filename, filepath, stats.size, type, tenantId, user?.id || null, user?.name || null)

    // Mettre à jour la config
    if (!tenantId) {
      db.prepare(`UPDATE backup_config SET last_backup_at = datetime('now', 'localtime'), last_backup_status = 'success' WHERE id = 1`).run()
    }

    // Rotation
    rotateBackups(db, tenantId)

    return { id: result.lastInsertRowid, filename }
  } catch (err) {
    console.error(`Erreur création backup (${tenantId || 'local'}):`, err.message)
    db.prepare(`
      INSERT INTO backups (filename, filepath, size_bytes, type, tenant_id, status, error_message, created_by, created_by_name)
      VALUES (?, ?, 0, ?, ?, 'failed', ?, ?, ?)
    `).run(filename, filepath, type, tenantId, err.message, user?.id || null, user?.name || null)

    if (!tenantId) {
      db.prepare(`UPDATE backup_config SET last_backup_at = datetime('now', 'localtime'), last_backup_status = 'failed' WHERE id = 1`).run()
    }
    throw err
  }
}

// ==================== ROTATION (GARDE LES 3 DERNIERS) ====================
export function rotateBackups(db, tenantId = null) {
  const all = db.prepare(`
    SELECT id, filepath FROM backups
    WHERE (tenant_id = ? OR (tenant_id IS NULL AND ? IS NULL))
      AND status = 'success'
    ORDER BY created_at DESC
  `).all(tenantId, tenantId)

  const toDelete = all.slice(3)
  for (const b of toDelete) {
    try { if (fs.existsSync(b.filepath)) fs.unlinkSync(b.filepath) } catch {}
    db.prepare('DELETE FROM backups WHERE id = ?').run(b.id)
  }
}

// ==================== LISTE & SUPPRESSION ====================
export function listBackups(db, tenantId = null) {
  return db.prepare(`
    SELECT id, filename, size_bytes, type, tenant_id, status, error_message, created_at, created_by_name
    FROM backups
    WHERE (tenant_id = ? OR (tenant_id IS NULL AND ? IS NULL))
    ORDER BY created_at DESC
  `).all(tenantId, tenantId)
}

export function deleteBackup(db, backupId) {
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId)
  if (!backup) throw new Error('Backup non trouvé')
  try { if (fs.existsSync(backup.filepath)) fs.unlinkSync(backup.filepath) } catch {}
  db.prepare('DELETE FROM backups WHERE id = ?').run(backupId)
}

// ==================== CRON ====================
export function startBackupCron(db, logAction) {
  // Tourne toutes les heures pour vérifier si un backup est nécessaire
  cron.schedule('0 * * * *', async () => {
    const config = getBackupConfig(db)
    if (!config || !config.enabled) return

    const last = config.last_backup_at ? new Date(config.last_backup_at) : null
    const now = new Date()
    const hoursSinceLast = last ? (now - last) / 3600000 : Infinity

    if (hoursSinceLast >= config.interval_hours) {
      console.log('⏰ Cron : Lancement des sauvegardes automatiques...')
      try {
        // 1. Backup local
        await createBackup(db, { type: 'auto' })
        
        // 2. Backup de tous les tenants Turso
        for (const tenantId of Object.keys(TENANTS)) {
          await createBackup(db, { type: 'auto', tenantId })
        }
        
        if (logAction) logAction(null, 'Système', 'backup_auto', 'backup', null, 'Sauvegarde automatique effectuée')
      } catch (err) {
        console.error('Erreur lors des backups automatiques:', err)
      }
    }
  })
  console.log('⏰ Cron de sauvegarde démarré (vérification toutes les heures)')
}

// ==================== ROUTES API ====================
export function createBackupRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // GET /api/admin/backups/config
  router.get('/config', (req, res) => {
    res.json(getBackupConfig(db))
  })

  // PATCH /api/admin/backups/config
  router.patch('/config', (req, res) => {
    try {
      const config = updateBackupConfig(db, req.body)
      logAction(req.user.id, req.user.name, 'update', 'backup_config', 1, `Interval: ${config.interval_hours}h, Actif: ${config.enabled}`)
      res.json(config)
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // GET /api/admin/backups
  router.get('/', (req, res) => {
    const tenantId = req.query.tenant_id || null
    res.json(listBackups(db, tenantId))
  })

  // POST /api/admin/backups (manuel)
  router.post('/', async (req, res) => {
    try {
      const { tenant_id } = req.body
      const result = await createBackup(db, { type: 'manual', tenantId: tenant_id || null, user: req.user })
      logAction(req.user.id, req.user.name, 'create', 'backup', result.id, `Backup manuel : ${result.filename}`)
      res.status(201).json(result)
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // DELETE /api/admin/backups/:id
  router.delete('/:id', (req, res) => {
    try {
      deleteBackup(db, req.params.id)
      logAction(req.user.id, req.user.name, 'delete', 'backup', req.params.id, 'Backup supprimé')
      res.json({ success: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // GET /api/admin/backups/:id/download
  router.get('/:id/download', (req, res) => {
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(req.params.id)
    if (!backup || !fs.existsSync(backup.filepath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' })
    }
    res.download(backup.filepath, backup.filename)
  })

  return router
}