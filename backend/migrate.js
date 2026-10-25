import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];

if (!tenant) {
  console.error(`❌ Entreprise inconnue : ${tenantId}`);
  process.exit(1);
}

console.log(`🚀 Migration de la base : ${tenant.name} (${tenantId})`);

const db = createClient({ url: tenant.url, authToken: tenant.token });

async function migrate() {
  try {
    // ==================== TABLES DE BASE ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user', custom_role TEXT, active INTEGER NOT NULL DEFAULT 1, otp_code TEXT, otp_expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`);
    await db.execute(`CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT, icon TEXT, color TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now', 'localtime')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, name TEXT, category TEXT, brand TEXT, model TEXT, serial_number TEXT, location TEXT, assigned_to INTEGER, status TEXT, purchase_date TEXT, warranty_end TEXT, editor TEXT, version TEXT, license_key TEXT, license_expires_at TEXT, license_count INTEGER, notes TEXT, created_at TEXT DEFAULT (datetime('now', 'localtime')), asset_tag TEXT, room_id INTEGER)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, action TEXT, entity TEXT, entity_id INTEGER, details TEXT, created_at TEXT DEFAULT (datetime('now', 'localtime')), reviewed INTEGER NOT NULL DEFAULT 0, reviewed_by TEXT, reviewed_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, category TEXT, priority TEXT, status TEXT, description TEXT, assignee TEXT, creator TEXT, created_by INTEGER, module_id INTEGER, asset_id INTEGER, archived INTEGER DEFAULT 0, archived_at TEXT, sla_response_deadline TEXT, sla_resolution_deadline TEXT, sla_paused_at TEXT, sla_paused_total_minutes INTEGER DEFAULT 0, resolved_at TEXT, sla_escalated INTEGER DEFAULT 0, incident_type TEXT DEFAULT 'standard', is_dora_major INTEGER DEFAULT 0, dora_criteria TEXT, dora_notification_date TEXT, created_at TEXT DEFAULT (datetime('now', 'localtime')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, author TEXT, text TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now', 'localtime')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS asset_files (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER NOT NULL, filename TEXT, mimetype TEXT, size INTEGER, data BLOB, uploaded_by INTEGER, uploaded_at TEXT DEFAULT (datetime('now', 'localtime')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS sla_policies (id INTEGER PRIMARY KEY AUTOINCREMENT, priority TEXT UNIQUE, response_minutes INTEGER, resolution_minutes INTEGER, escalation_percent INTEGER, active INTEGER, created_at TEXT, updated_at TEXT)`);

    // ==================== PERMISSIONS & RÔLES ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, label TEXT, module TEXT, description TEXT, created_at TEXT DEFAULT (datetime('now', 'localtime')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS user_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, permission_code TEXT NOT NULL, granted_by_id INTEGER, granted_by_name TEXT, granted_at TEXT, UNIQUE(user_id, permission_code))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL, permission_code TEXT NOT NULL, PRIMARY KEY (role_id, permission_code))`);

    // ==================== KNOWLEDGE BASE ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS kb_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, description TEXT, icon TEXT, color TEXT, active INTEGER, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS kb_articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, summary TEXT, category_id INTEGER, tags TEXT, status TEXT, is_known_error INTEGER, workaround TEXT, author_id INTEGER, author_name TEXT, views INTEGER, helpful_yes INTEGER, helpful_no INTEGER, created_at TEXT, updated_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS kb_article_history (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER, old_content TEXT, new_content TEXT, changed_by_id INTEGER, changed_by_name TEXT, changed_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS kb_article_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER, ticket_id INTEGER, linked_by_id INTEGER, linked_by_name TEXT, linked_at TEXT, UNIQUE(article_id, ticket_id))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS kb_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER, user_id INTEGER, helpful INTEGER, voted_at TEXT, UNIQUE(article_id, user_id))`);

    // ==================== GDPR ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS gdpr_processing (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, data_categories TEXT, purpose TEXT, legal_basis TEXT, data_subjects TEXT, recipients TEXT, retention_period TEXT, security_measures TEXT, data_location TEXT, is_sensitive INTEGER, created_at TEXT, updated_at TEXT, updated_by TEXT)`);

    // ==================== CMDB ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS configuration_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT UNIQUE, type TEXT, description TEXT, status TEXT, environment TEXT, location TEXT, owner TEXT, criticality TEXT, asset_id INTEGER, notes TEXT, created_at TEXT, updated_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS ci_relations (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER, child_id INTEGER, relation_type TEXT, description TEXT, created_at TEXT, UNIQUE(parent_id, child_id, relation_type))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS ticket_cis (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, ci_id INTEGER, is_primary INTEGER, linked_by_id INTEGER, linked_at TEXT, UNIQUE(ticket_id, ci_id))`);

    // ==================== PROBLÈMES ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS problems (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, symptoms TEXT, root_cause TEXT, workaround TEXT, status TEXT, priority TEXT, category TEXT, assigned_to TEXT, detected_at TEXT, resolved_at TEXT, kb_article_id INTEGER, created_by INTEGER, created_by_name TEXT, created_at TEXT, updated_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS problem_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, problem_id INTEGER, ticket_id INTEGER, linked_by_id INTEGER, linked_by_name TEXT, linked_at TEXT, UNIQUE(problem_id, ticket_id))`);

    // ==================== CATALOGUE ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS service_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, category TEXT, icon TEXT, color TEXT, form_fields TEXT, sla_hours INTEGER, requires_approval INTEGER, approver_role TEXT, active INTEGER, created_at TEXT, updated_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS service_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, service_id INTEGER, ticket_id INTEGER, requester_id INTEGER, form_data TEXT, status TEXT, approved_by INTEGER, approved_at TEXT, rejection_reason TEXT, created_at TEXT)`);

    // ==================== CHANGEMENTS ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS changes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, change_type TEXT, category TEXT, status TEXT, priority TEXT, risk_level TEXT, impact_analysis TEXT, affected_cis TEXT, requested_by INTEGER, assigned_to INTEGER, approved_by INTEGER, approved_at TEXT, rejection_reason TEXT, scheduled_start TEXT, scheduled_end TEXT, implementation_plan TEXT, rollback_plan TEXT, implemented_at TEXT, closed_at TEXT, created_at TEXT, updated_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS change_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, change_id INTEGER, ticket_id INTEGER, linked_by INTEGER, linked_at TEXT, UNIQUE(change_id, ticket_id))`);

    // ==================== FOURNISSEURS ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, contact_name TEXT, email TEXT, phone TEXT, contract_type TEXT, contract_start TEXT, contract_end TEXT, status TEXT, notes TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS supplier_files (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, filename TEXT, mimetype TEXT, size INTEGER, data BLOB, uploaded_by INTEGER, uploaded_at TEXT)`);

    // ==================== RISQUES ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS risks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, category TEXT, probability INTEGER, impact INTEGER, score INTEGER, mitigation_plan TEXT, owner TEXT, status TEXT, created_at TEXT, updated_at TEXT)`);

    // ==================== FACILITY & RESSOURCES ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS floors (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER, name TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, floor_id INTEGER, name TEXT, type TEXT, code TEXT UNIQUE, capacity INTEGER)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS physical_resources (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, name TEXT, unique_code TEXT UNIQUE, room_id INTEGER, status TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS resource_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER, user_id INTEGER, booking_date TEXT, slot TEXT, created_at TEXT, patient_name TEXT, patient_dob TEXT, start_date TEXT, end_date TEXT, UNIQUE(resource_id, booking_date, slot))`);

    // ==================== DPI (MÉDICAL) ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_code TEXT UNIQUE, first_name TEXT, last_name TEXT, dob TEXT, gender TEXT, phone TEXT, address TEXT, nir TEXT, blood_type TEXT, allergies TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, doctor_id INTEGER, reason TEXT, status TEXT, created_at TEXT, started_at TEXT, finished_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS medical_records (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, visit_id INTEGER, doctor_id INTEGER, chief_complaint TEXT, diagnosis TEXT, notes TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS prescriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, record_id INTEGER, patient_id INTEGER, medication TEXT, dosage TEXT, duration TEXT, status TEXT, created_at TEXT)`);
    await db.execute(`CREATE TABLE IF NOT EXISTS exam_results (id INTEGER PRIMARY KEY AUTOINCREMENT, record_id INTEGER, patient_id INTEGER, exam_type TEXT, status TEXT, result_notes TEXT, file_data BLOB, file_name TEXT, created_at TEXT)`);

    // ==================== NOTIFICATIONS ====================
    await db.execute(`CREATE TABLE IF NOT EXISTS user_notifications_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, notify_ticket_assigned INTEGER DEFAULT 1, notify_status_changed INTEGER DEFAULT 1, notify_new_comment INTEGER DEFAULT 1, notify_sla_exceeded INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT)`);

    console.log('✅ Toutes les tables ont été créées avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la migration :', err);
    process.exit(1);
  }
}

migrate();