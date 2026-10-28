// backend/notifications-db.js
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================

export function initNotificationsTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_email TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read)`)
  console.log('✅ Tables Notifications initialisées')
}

// ==================== HELPER : CRÉER UNE NOTIFICATION ====================

/**
 * Crée une notification dans la base (SQLite local ou Turso)
 * @param {object} db - Base SQLite locale (better-sqlite3)
 * @param {object} params - { tenantId, userId, userEmail, type, title, message, link }
 */
export async function createNotification(db, params) {
  const { tenantId, userId, userEmail, type, title, message, link } = params

  // MODE TURSO
  if (tenantId) {
    const tenant = TENANTS[tenantId]
    if (!tenant) return
    const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

    try {
      await tursoDb.execute({
        sql: `INSERT INTO notifications (user_id, user_email, type, title, message, link)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [userId, userEmail || null, type, title, message || null, link || null]
      })
    } catch (err) {
      console.error('Erreur createNotification Turso:', err)
    }
    return
  }

  // MODE SQLITE
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, user_email, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, userEmail || null, type, title, message || null, link || null)
  } catch (err) {
    console.error('Erreur createNotification SQLite:', err)
  }
}