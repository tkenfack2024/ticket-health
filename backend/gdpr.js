import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'

// ==================== INITIALISATION ====================

export function initGdprTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gdpr_processing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      data_categories TEXT,
      purpose TEXT,
      legal_basis TEXT,
      data_subjects TEXT,
      recipients TEXT,
      retention_period TEXT,
      security_measures TEXT,
      data_location TEXT,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      updated_by TEXT
    )
  `)

  // Seed : traitements par défaut
  const count = db.prepare('SELECT COUNT(*) as c FROM gdpr_processing').get().c
  if (count === 0) {
    const defaults = [
      {
        name: 'Gestion des comptes utilisateurs',
        description: 'Création et gestion des comptes employés',
        data_categories: 'Nom, email, téléphone, mot de passe (hashé)',
        purpose: 'Authentification et contrôle d\'accès',
        legal_basis: 'Exécution du contrat de travail',
        data_subjects: 'Employés de l\'établissement',
        recipients: 'Service informatique, Administrateurs',
        retention_period: '5 ans après fin de contrat',
        security_measures: 'JWT, bcrypt, rôles, permissions granulaires',
        data_location: 'Base SQLite locale (backend/tickets.db)',
        is_sensitive: 0,
      },
      {
        name: 'Gestion des tickets de support',
        description: 'Traitement des demandes d\'assistance IT',
        data_categories: 'Nom, description du problème, échanges',
        purpose: 'Résolution des incidents IT',
        legal_basis: 'Intérêt légitime (continuité de service)',
        data_subjects: 'Employés',
        recipients: 'Techniciens, Administrateurs',
        retention_period: '3 ans après clôture',
        security_measures: 'Contrôle d\'accès, filtrage par rôle, journalisation',
        data_location: 'Base SQLite locale',
        is_sensitive: 0,
      },
      {
        name: 'Envoi d\'OTP par email',
        description: 'Envoi de codes à usage unique par email pour authentification',
        data_categories: 'Email, nom, code OTP',
        purpose: 'Authentification sécurisée',
        legal_basis: 'Exécution du contrat',
        data_subjects: 'Employés',
        recipients: 'Google (Gmail SMTP) — sous-traitant',
        retention_period: '5 minutes (code OTP éphémère)',
        security_measures: 'Expiration 5 min, HTTPS pour l\'envoi',
        data_location: 'Base SQLite + Gmail (transit)',
        is_sensitive: 0,
      },
      {
        name: 'Journal d\'audit',
        description: 'Enregistrement des actions utilisateurs',
        data_categories: 'User ID, nom, action, entité, timestamp',
        purpose: 'Traçabilité et conformité réglementaire',
        legal_basis: 'Obligation légale',
        data_subjects: 'Employés, Administrateurs',
        recipients: 'Administrateurs, Auditeurs',
        retention_period: '5 ans (obligation légale)',
        security_measures: 'Accès réservé aux admins, immutabilité',
        data_location: 'Base SQLite locale',
        is_sensitive: 0,
      },
      {
        name: 'Base de connaissances',
        description: 'Articles de documentation IT',
        data_categories: 'Nom auteur, contenu technique',
        purpose: 'Partage de connaissances',
        legal_basis: 'Intérêt légitime',
        data_subjects: 'Employés (auteurs)',
        recipients: 'Tous les utilisateurs avec permission kb.read',
        retention_period: 'Conservation permanente (archivage)',
        security_measures: 'Contrôle par permissions',
        data_location: 'Base SQLite locale',
        is_sensitive: 0,
      },
    ]

    const insert = db.prepare(`
      INSERT INTO gdpr_processing (
        name, description, data_categories, purpose, legal_basis,
        data_subjects, recipients, retention_period, security_measures,
        data_location, is_sensitive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const d of defaults) {
      insert.run(
        d.name, d.description, d.data_categories, d.purpose, d.legal_basis,
        d.data_subjects, d.recipients, d.retention_period, d.security_measures,
        d.data_location, d.is_sensitive
      )
    }

    console.log('✅ Registre GDPR : 5 traitements initiaux créés')
  }
}

// ==================== ROUTES ====================

export function createGdprRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/gdpr/processing ----
  router.get('/processing', (req, res) => {
    const items = db.prepare(`
      SELECT * FROM gdpr_processing
      ORDER BY is_sensitive DESC, name ASC
    `).all()
    res.json(items)
  })

  // ---- GET /api/gdpr/processing/:id ----
  router.get('/processing/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(req.params.id)
    if (!item) return res.status(404).json({ error: 'Traitement non trouvé' })
    res.json(item)
  })

  // ---- POST /api/gdpr/processing ----
  router.post('/processing', (req, res) => {
    const {
      name, description, data_categories, purpose, legal_basis,
      data_subjects, recipients, retention_period, security_measures,
      data_location, is_sensitive
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est obligatoire' })
    }

    const result = db.prepare(`
      INSERT INTO gdpr_processing (
        name, description, data_categories, purpose, legal_basis,
        data_subjects, recipients, retention_period, security_measures,
        data_location, is_sensitive, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      description?.trim() || null,
      data_categories?.trim() || null,
      purpose?.trim() || null,
      legal_basis?.trim() || null,
      data_subjects?.trim() || null,
      recipients?.trim() || null,
      retention_period?.trim() || null,
      security_measures?.trim() || null,
      data_location?.trim() || null,
      is_sensitive ? 1 : 0,
      req.user.name
    )

    const item = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'gdpr_processing', item.id, `Traitement GDPR créé : ${item.name}`)

    res.status(201).json(item)
  })

  // ---- PATCH /api/gdpr/processing/:id ----
  router.patch('/processing/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const item = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(targetId)
    if (!item) return res.status(404).json({ error: 'Traitement non trouvé' })

    const allowed = [
      'name', 'description', 'data_categories', 'purpose', 'legal_basis',
      'data_subjects', 'recipients', 'retention_period', 'security_measures',
      'data_location', 'is_sensitive'
    ]

    const updates = []
    const values = []
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'is_sensitive') {
          values.push(req.body[field] ? 1 : 0)
        } else {
          values.push(req.body[field] || null)
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    }

    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    updates.push('updated_by = ?')
    values.push(req.user.name)
    values.push(targetId)

    db.prepare(`UPDATE gdpr_processing SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'gdpr_processing', targetId, `Traitement GDPR modifié : ${updated.name}`)

    res.json(updated)
  })

  // ---- DELETE /api/gdpr/processing/:id ----
  router.delete('/processing/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const item = db.prepare('SELECT * FROM gdpr_processing WHERE id = ?').get(targetId)
    if (!item) return res.status(404).json({ error: 'Traitement non trouvé' })

    db.prepare('DELETE FROM gdpr_processing WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'gdpr_processing', targetId, `Traitement GDPR supprimé : ${item.name}`)

    res.json({ success: true })
  })

  // ---- GET /api/gdpr/export ----
  // Export du registre en CSV
  router.get('/export', (req, res) => {
    const items = db.prepare('SELECT * FROM gdpr_processing ORDER BY name ASC').all()

    const headers = [
      'ID', 'Nom', 'Description', 'Données traitées', 'Finalité', 'Base légale',
      'Personnes concernées', 'Destinataires', 'Durée de conservation',
      'Mesures de sécurité', 'Localisation', 'Sensible', 'Créé le', 'Modifié le'
    ]

    const csvEscape = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }

    const rows = items.map(i => [
      i.id, i.name, i.description, i.data_categories, i.purpose, i.legal_basis,
      i.data_subjects, i.recipients, i.retention_period, i.security_measures,
      i.data_location, i.is_sensitive ? 'Oui' : 'Non', i.created_at, i.updated_at
    ].map(csvEscape).join(','))

    const csv = [headers.join(','), ...rows].join('\n')

    const dateStr = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="registre-gdpr-${dateStr}.csv"`)
    res.send('\uFEFF' + csv)
  })

  return router
}