// backend/logger.js
// Fonctions de journalisation pour SQLite (local) et Turso (cloud multi-tenant)

/**
 * Écrit un log dans la base SQLite locale (better-sqlite3)
 */
export function logAction(db, userId, userName, action, entity, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO logs (user_id, user_name, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId || null, userName || 'Système', action, entity, entityId || null, details || null)
  } catch (err) {
    if (!err.message.includes('FOREIGN KEY')) {
      console.error('Erreur logAction SQLite:', err)
    }
  }
}

/**
 * Écrit un log dans la base Turso (cloud multi-tenant)
 */
export async function logActionTurso(tursoDb, userId, userName, action, entity, entityId, details) {
  try {
    await tursoDb.execute({
      sql: `INSERT INTO logs (user_id, user_name, action, entity, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId || null, userName || 'Système', action, entity, entityId || null, details || null]
    })
  } catch (err) {
    console.error('Erreur logActionTurso:', err)
  }
}