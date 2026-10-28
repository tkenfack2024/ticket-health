import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { applySlaToTicket } from './sla.js'

// ==================== INITIALISATION ====================

export function initCatalogTables(db) {
  // Table des services
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      icon TEXT DEFAULT 'Package',
      color TEXT DEFAULT 'blue',
      form_fields TEXT,
      sla_hours INTEGER DEFAULT 24,
      requires_approval INTEGER NOT NULL DEFAULT 1,
      approver_role TEXT DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    )
  `)

  // Table des demandes
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      ticket_id INTEGER,
      requester_id INTEGER NOT NULL,
      form_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending_approval' CHECK(status IN (
        'pending_approval', 'approved', 'rejected', 'delivered'
      )),
      approved_by INTEGER,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  // Seed : 6 services par défaut
  const count = db.prepare('SELECT COUNT(*) as c FROM service_catalog').get().c
  if (count === 0) {
    const defaultServices = [
      {
        name: 'Demander un PC portable',
        description: 'Commander un nouvel ordinateur portable pour votre travail',
        category: 'Hardware',
        icon: 'Monitor',
        color: 'blue',
        sla_hours: 120, // 5 jours ouvrés
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'marque', label: 'Marque souhaitée', type: 'select', options: ['Dell', 'HP', 'Lenovo', 'Apple', 'Peu importe'], required: true },
          { name: 'usage', label: 'Usage principal', type: 'select', options: ['Bureautique', 'Développement', 'Design', 'Médical', 'Autre'], required: true },
          { name: 'justification', label: 'Justification', type: 'textarea', required: true, placeholder: 'Pourquoi avez-vous besoin de ce PC ?' },
        ]),
      },
      {
        name: 'Demander un accès VPN',
        description: 'Obtenir un accès au réseau privé virtuel de l\'établissement',
        category: 'Access',
        icon: 'Shield',
        color: 'purple',
        sla_hours: 2,
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'reason', label: 'Motif de la demande', type: 'textarea', required: true },
          { name: 'duration', label: 'Durée souhaitée', type: 'select', options: ['1 jour', '1 semaine', '1 mois', 'Permanent'], required: true },
        ]),
      },
      {
        name: 'Demander une adresse email',
        description: 'Créer une nouvelle adresse email professionnelle',
        category: 'Software',
        icon: 'Mail',
        color: 'green',
        sla_hours: 24,
        requires_approval: 0,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'desired_email', label: 'Adresse souhaitée', type: 'text', required: true, placeholder: 'prenom.nom@healthticket.com' },
          { name: 'department', label: 'Service', type: 'text', required: true },
        ]),
      },
      {
        name: 'Signaler une panne d\'imprimante',
        description: 'Signaler un problème sur une imprimante',
        category: 'Incident',
        icon: 'Printer',
        color: 'red',
        sla_hours: 8,
        requires_approval: 0,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'location', label: 'Localisation de l\'imprimante', type: 'text', required: true, placeholder: 'Bureau 204, Étage 2...' },
          { name: 'problem', label: 'Description du problème', type: 'textarea', required: true },
        ]),
      },
      {
        name: 'Demander un logiciel',
        description: 'Installer un nouveau logiciel sur votre poste',
        category: 'Software',
        icon: 'Package',
        color: 'amber',
        sla_hours: 48,
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'software_name', label: 'Nom du logiciel', type: 'text', required: true },
          { name: 'version', label: 'Version souhaitée', type: 'text', required: false },
          { name: 'justification', label: 'Justification', type: 'textarea', required: true },
        ]),
      },
      {
        name: 'Demander une formation',
        description: 'Demander une formation IT',
        category: 'Formation',
        icon: 'BookOpen',
        color: 'slate',
        sla_hours: 240, // 10 jours ouvrés
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'topic', label: 'Sujet de la formation', type: 'text', required: true },
          { name: 'level', label: 'Niveau', type: 'select', options: ['Débutant', 'Intermédiaire', 'Avancé'], required: true },
        ]),
      },
    ]

    const insert = db.prepare(`
      INSERT INTO service_catalog (
        name, description, category, icon, color, form_fields,
        sla_hours, requires_approval, approver_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const s of defaultServices) {
      insert.run(
        s.name, s.description, s.category, s.icon, s.color, s.form_fields,
        s.sla_hours, s.requires_approval, s.approver_role
      )
    }
    console.log('✅ Catalogue de services : 6 services créés')
  }
}

// ==================== ROUTES ====================

export function createCatalogRouter(db, logAction) {
  const router = Router()

  // ============ ROUTES PUBLIQUES (auth requise) ============

  // Liste des services actifs
  router.get('/services', authRequired, (req, res) => {
    const services = db.prepare(`
      SELECT
        id, name, description, category, icon, color,
        sla_hours, requires_approval, approver_role, form_fields
      FROM service_catalog
      WHERE active = 1
      ORDER BY category ASC, name ASC
    `).all()

    // Parser form_fields
    for (const s of services) {
      try {
        s.form_fields = s.form_fields ? JSON.parse(s.form_fields) : []
      } catch {
        s.form_fields = []
      }
    }

    res.json(services)
  })

  // Détail d'un service
  router.get('/services/:id', authRequired, (req, res) => {
    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ? AND active = 1').get(req.params.id)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })

    try {
      service.form_fields = service.form_fields ? JSON.parse(service.form_fields) : []
    } catch {
      service.form_fields = []
    }

    res.json(service)
  })

  // Créer une demande
  router.post('/requests', authRequired, (req, res) => {
    const { service_id, form_data } = req.body

    if (!service_id || !form_data) {
      return res.status(400).json({ error: 'service_id et form_data obligatoires' })
    }

    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ? AND active = 1').get(service_id)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })

    const formDataStr = typeof form_data === 'string' ? form_data : JSON.stringify(form_data)
    const initialStatus = service.requires_approval ? 'pending_approval' : 'approved'

    // 🔥 SÉCURITÉ ANTI-CRASH FK : Si l'utilisateur vient de Turso et n'existe pas en local, on le crée.
    let localUserId = req.user.id
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(localUserId)
    if (!userExists) {
      try {
        db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)')
          .run(req.user.id, req.user.name, req.user.email || 'user@local', 'user')
      } catch (e) {
        // Si l'ID est déjà pris, on utilise l'admin local (id=1) par défaut
        localUserId = 1
      }
    }

    const result = db.prepare(`
      INSERT INTO service_requests (service_id, requester_id, form_data, status, approved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      service_id,
      localUserId,
      formDataStr,
      initialStatus,
      initialStatus === 'approved' ? new Date().toISOString() : null
    )

    const requestId = result.lastInsertRowid

    // Si pas d'approbation requise → créer le ticket directement
    if (!service.requires_approval) {
      createTicketFromRequest(db, requestId, service, req.user, logAction)
    }

    logAction(localUserId, req.user.name, 'create', 'service_request', requestId,
      `Demande de service : ${service.name}`)

    const newRequest = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    res.status(201).json(newRequest)
  })

  // Mes demandes
  router.get('/my-requests', authRequired, (req, res) => {
    const requests = db.prepare(`
      SELECT
        sr.*,
        sc.name as service_name,
        sc.icon as service_icon,
        sc.color as service_color,
        sc.category as service_category,
        u.name as approved_by_name,
        t.title as ticket_title,
        t.status as ticket_status
      FROM service_requests sr
      JOIN service_catalog sc ON sr.service_id = sc.id
      LEFT JOIN users u ON sr.approved_by = u.id
      LEFT JOIN tickets t ON sr.ticket_id = t.id
      WHERE sr.requester_id = ?
      ORDER BY sr.created_at DESC
    `).all(req.user.id)

    for (const r of requests) {
      try {
        r.form_data = r.form_data ? JSON.parse(r.form_data) : {}
      } catch {
        r.form_data = {}
      }
    }

    res.json(requests)
  })

  // Détail d'une demande
  router.get('/requests/:id', authRequired, (req, res) => {
    const request = db.prepare(`
      SELECT
        sr.*,
        sc.name as service_name,
        sc.description as service_description,
        sc.icon as service_icon,
        sc.color as service_color,
        sc.category as service_category,
        sc.sla_hours,
        sc.form_fields as service_form_fields,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_app.name as approved_by_name,
        t.id as ticket_id,
        t.title as ticket_title,
        t.status as ticket_status
      FROM service_requests sr
      JOIN service_catalog sc ON sr.service_id = sc.id
      LEFT JOIN users u_req ON sr.requester_id = u_req.id
      LEFT JOIN users u_app ON sr.approved_by = u_app.id
      LEFT JOIN tickets t ON sr.ticket_id = t.id
      WHERE sr.id = ?
    `).get(req.params.id)

    if (!request) return res.status(404).json({ error: 'Demande non trouvée' })

    // Vérifier accès (créateur ou admin)
    if (request.requester_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    try {
      request.form_data = request.form_data ? JSON.parse(request.form_data) : {}
      request.service_form_fields = request.service_form_fields ? JSON.parse(request.service_form_fields) : []
    } catch {
      request.form_data = {}
      request.service_form_fields = []
    }

    res.json(request)
  })

  // ============ ROUTES ADMIN ============

  // Toutes les demandes (admin)
  router.get('/admin/requests', authRequired, adminOnly, (req, res) => {
    const { status } = req.query
    let query = `
      SELECT
        sr.*,
        sc.name as service_name,
        sc.icon as service_icon,
        sc.color as service_color,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_app.name as approved_by_name
      FROM service_requests sr
      JOIN service_catalog sc ON sr.service_id = sc.id
      LEFT JOIN users u_req ON sr.requester_id = u_req.id
      LEFT JOIN users u_app ON sr.approved_by = u_app.id
      WHERE 1=1
    `
    const params = []

    if (status) {
      query += ' AND sr.status = ?'
      params.push(status)
    }

    query += ' ORDER BY sr.created_at DESC'

    const requests = db.prepare(query).all(...params)

    for (const r of requests) {
      try {
        r.form_data = r.form_data ? JSON.parse(r.form_data) : {}
      } catch {
        r.form_data = {}
      }
    }

    res.json(requests)
  })

  // Approuver une demande
  router.post('/admin/requests/:id/approve', authRequired, adminOnly, (req, res) => {
    const requestId = parseInt(req.params.id)
    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    if (!request) return res.status(404).json({ error: 'Demande non trouvée' })

    if (request.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Cette demande n\'est pas en attente d\'approbation' })
    }

    db.prepare(`
      UPDATE service_requests
      SET status = 'approved',
          approved_by = ?,
          approved_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.user.id, requestId)

    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(request.service_id)
    const requester = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(request.requester_id)

    // Créer le ticket
    createTicketFromRequest(db, requestId, service, requester, logAction)

    logAction(req.user.id, req.user.name, 'approve', 'service_request', requestId,
      `Demande approuvée : ${service.name}`)

    res.json({ success: true })
  })

  // Refuser une demande
  router.post('/admin/requests/:id/reject', authRequired, adminOnly, (req, res) => {
    const requestId = parseInt(req.params.id)
    const { reason } = req.body

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Motif de refus obligatoire' })
    }

    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    if (!request) return res.status(404).json({ error: 'Demande non trouvée' })

    if (request.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Cette demande n\'est pas en attente d\'approbation' })
    }

    db.prepare(`
      UPDATE service_requests
      SET status = 'rejected',
          approved_by = ?,
          approved_at = datetime('now', 'localtime'),
          rejection_reason = ?
      WHERE id = ?
    `).run(req.user.id, reason.trim(), requestId)

    logAction(req.user.id, req.user.name, 'reject', 'service_request', requestId,
      `Demande refusée : ${reason}`)

    res.json({ success: true })
  })

  // CRUD services (admin)
  router.get('/admin/services', authRequired, adminOnly, (req, res) => {
    const services = db.prepare(`
      SELECT
        sc.*,
        (SELECT COUNT(*) FROM service_requests WHERE service_id = sc.id) as request_count
      FROM service_catalog sc
      ORDER BY sc.category ASC, sc.name ASC
    `).all()

    for (const s of services) {
      try {
        s.form_fields = s.form_fields ? JSON.parse(s.form_fields) : []
      } catch {
        s.form_fields = []
      }
    }

    res.json(services)
  })

  router.post('/admin/services', authRequired, adminOnly, (req, res) => {
    const {
      name, description, category, icon, color,
      form_fields, sla_hours, requires_approval, approver_role
    } = req.body

    if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' })

    try {
      const formFieldsStr = typeof form_fields === 'string' ? form_fields : JSON.stringify(form_fields || [])

      const result = db.prepare(`
        INSERT INTO service_catalog (
          name, description, category, icon, color, form_fields,
          sla_hours, requires_approval, approver_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        description?.trim() || null,
        category || null,
        icon || 'Package',
        color || 'blue',
        formFieldsStr,
        sla_hours || 24,
        requires_approval ? 1 : 0,
        approver_role || 'admin'
      )

      logAction(req.user.id, req.user.name, 'create', 'service_catalog', result.lastInsertRowid,
        `Service créé : ${name}`)

      res.status(201).json({ id: result.lastInsertRowid, success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.patch('/admin/services/:id', authRequired, adminOnly, (req, res) => {
    const targetId = parseInt(req.params.id)
    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(targetId)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })

    const allowed = ['name', 'description', 'category', 'icon', 'color', 'form_fields', 'sla_hours', 'requires_approval', 'approver_role', 'active']
    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'form_fields') {
          values.push(typeof req.body[field] === 'string' ? req.body[field] : JSON.stringify(req.body[field]))
        } else if (field === 'requires_approval' || field === 'active') {
          values.push(req.body[field] ? 1 : 0)
        } else {
          values.push(req.body[field])
        }
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })

    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    values.push(targetId)

    db.prepare(`UPDATE service_catalog SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    logAction(req.user.id, req.user.name, 'update', 'service_catalog', targetId,
      `Service modifié : ${service.name}`)

    res.json({ success: true })
  })

  router.delete('/admin/services/:id', authRequired, adminOnly, (req, res) => {
    const targetId = parseInt(req.params.id)
    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(targetId)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })

    db.prepare('UPDATE service_catalog SET active = 0 WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'deactivate', 'service_catalog', targetId,
      `Service désactivé : ${service.name}`)

    res.json({ success: true })
  })

  return router
}

// ==================== CRÉATION TICKET ====================

function createTicketFromRequest(db, requestId, service, requester, logAction) {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
  if (!request || request.ticket_id) return // Déjà un ticket

  let formData = {}
  try {
    formData = JSON.parse(request.form_data)
  } catch {}

  // Construire la description du ticket
  const description = `**Demande via le catalogue** : ${service.name}\n\n**Détails :**\n${Object.entries(formData)
    .map(([k, v]) => `- **${k}** : ${v}`)
    .join('\n')}`

  // 🔥 SÉCURITÉ ANTI-CRASH FK pour le ticket
  let localUserId = requester.id
  const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(localUserId)
  if (!userExists) {
    try {
      db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)')
        .run(requester.id, requester.name, requester.email || 'user@local', 'user')
    } catch (e) {
      localUserId = 1 // Fallback admin
    }
  }

  // Créer le ticket
  const result = db.prepare(`
    INSERT INTO tickets (title, category, priority, description, created_by, creator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `[Demande] ${service.name}`,
    service.category || 'Autre',
    service.sla_hours <= 2 ? 'Urgente' : service.sla_hours <= 24 ? 'Haute' : 'Moyenne',
    description,
    localUserId, // 👈 ID corrigé
    requester.name
  )

  const ticketId = result.lastInsertRowid

    // Appliquer le SLA
  try {
    applySlaToTicket(db, ticketId, service.sla_hours <= 2 ? 'Urgente' : service.sla_hours <= 24 ? 'Haute' : 'Moyenne')
  } catch (err) {
    console.error('Erreur application SLA depuis le catalogue:', err)
  }

  // Mettre à jour la demande
  db.prepare('UPDATE service_requests SET ticket_id = ?, status = ? WHERE id = ?').run(ticketId, 'delivered', requestId)

  if (logAction) {
    logAction(localUserId, requester.name, 'create', 'ticket', ticketId,
      `Ticket créé depuis la demande de service #${requestId}`)
  }

  return ticketId
}