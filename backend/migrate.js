import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

// On choisit l'entreprise à migrer (par défaut : entreprise-test)
const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];

if (!tenant) {
  console.error(`❌ Entreprise inconnue : ${tenantId}`);
  process.exit(1);
}

console.log(`🚀 Migration de la base : ${tenant.name} (${tenantId})`);

const db = createClient({
  url: tenant.url,
  authToken: tenant.token,
});

async function migrate() {
  try {
    // ==================== TABLES DE BASE ====================
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        custom_role TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        otp_code TEXT,
        otp_expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        module TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL,
        permission_code TEXT NOT NULL,
        PRIMARY KEY (role_id, permission_code),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        permission_code TEXT NOT NULL,
        granted_by_id INTEGER,
        granted_by_name TEXT,
        granted_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(user_id, permission_code)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_notifications_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        notify_ticket_assigned INTEGER NOT NULL DEFAULT 1,
        notify_status_changed INTEGER NOT NULL DEFAULT 1,
        notify_new_comment INTEGER NOT NULL DEFAULT 1,
        notify_sla_exceeded INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT,
        reviewed INTEGER NOT NULL DEFAULT 0,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // ==================== MODULES MÉTIER ====================
    
    await db.execute(`
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
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // (Ajoutez ici les autres tables : patients, visits, medical_records, etc.)

    console.log('✅ Toutes les tables ont été créées avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la migration :', err);
    process.exit(1);
  }
}

migrate();