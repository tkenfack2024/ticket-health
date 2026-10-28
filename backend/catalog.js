import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { applySlaToTicket } from './sla.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================
export function initCatalogTables(db) {
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

  const count = db.prepare('SELECT COUNT(*) as c FROM service_catalog').get().c
  if (count === 0) {
    const defaultServices = [
      {
        name: 'Demander un PC portable',
        description: 'Commander un nouvel ordinateur portable pour votre travail',
        category: 'Hardware',
        icon: 'Monitor',
        color: 'blue',
        sla_hours: 120,
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'marque', label: 'Marque souhaitée', type: 'select', options: ['Dell', 'HP', 'Lenovo', 'Apple', 'Peu importe'], required: true },
          { name: 'usage', label: 'Usage principal', type: 'select', options: ['Bureautique', 'Développement', 'Design', 'Médical', 'Autre'], required: true },
          { name: 'justification', label: 'Justification', type: 'textarea', required: true, placeholder: 'Pourquoi avez-vous besoin de ce PC ?' }
        ])
      },
      {
        name: 'Demander un accès VPN',
        description: "Obtenir un accès au réseau privé virtuel de l'établissement",
        category: 'Access',
        icon: 'Shield',
        color: 'purple',
        sla_hours: 2,
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'reason', label: 'Motif de la demande', type: 'textarea', required: true },
          { name: 'duration', label: 'Durée souhaitée', type: 'select', options: ['1 jour', '1 semaine', '1 mois', 'Permanent'], required: true }
        ])
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
          { name: 'department', label: 'Service', type: 'text', required: true }
        ])
      },
      {
        name: "Signaler une panne d'imprimante",
        description: 'Signaler un problème sur une imprimante',
        category: 'Incident',
        icon: 'Printer',
        color: 'red',
        sla_hours: 8,
        requires_approval: 0,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'location', label: "Localisation de l'imprimante", type: 'text', required: true, placeholder: 'Bureau 204, Étage 2...' },
          { name: 'problem', label: 'Description du problème', type: 'textarea', required: true }
        ])
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
          { name: 'justification', label: 'Justification', type: 'textarea', required: true }
        ])
      },
      {
        name: 'Demander une formation',
        description: 'Demander une formation IT',
        category: 'Formation',
        icon: 'BookOpen',
        color: 'slate',
        sla_hours: 240,
        requires_approval: 1,
        approver_role: 'admin',
        form_fields: JSON.stringify([
          { name: 'topic', label: 'Sujet de la formation', type: 'text', required: true },
          { name: 'level', label: 'Niveau', type: 'select', options: ['Débutant', 'Intermédiaire', 'Avancé'], required: true }
        ])
      }
    ]

    const insert = db.prepare(`
      INSERT INTO service_catalog
        (name, description, category, icon, color, form_fields, sla_hours, requires_approval, approver_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const s of defaultServices) {
      insert.run(
        s.name, s.description, s.category, s.icon, s.color,
        s.form_fields, s.sla_hours, s.requires_approval, s.approver_role
      )
    }
    console.log('✅ Catalogue de services : 6 services créés (Local)')
  }
}

// ==================== HELPERS ====================
function safeParseJSON(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function getPriorityFromSlaHours(slaHours) {
  if (slaHours <= 2) return 'Urgente'
  if (slaHours <= 24) return 'Haute'
  return 'Moyenne'
}

function formatLocalDateTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

// ==================== ROUTES ====================
export function createCatalogRouter(db, logAction) {
  const router = Router()

  // ---- GET /services ----
  router.get('/services', authRequired, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute(`
          SELECT id, name, description, category, icon, color, sla_hours,
                 requires_approval, approver_role, form_fields
          FROM service_catalog WHERE active = 1 ORDER BY category ASC, name ASC
        `)
        const services = result.rows.map(s => ({ ...s, form_fields: safeParseJSON(s.form_fields, []) }))
        return res.json(services)
      } catch (err) {
        console.error('Erreur Turso GET services:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    const services = db.prepare(`
      SELECT id, name, description, category, icon, color, sla_hours,
             requires_approval, approver_role, form_fields
      FROM service_catalog WHERE active = 1 ORDER BY category ASC, name ASC
    `).all()
    for (const s of services) s.form_fields = safeParseJSON(s.form_fields, [])
    res.json(services)
  })

  // ---- GET /services/:id ----
  router.get('/services/:id', authRequired, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({ sql: 'SELECT * FROM service_catalog WHERE id = ? AND active = 1', args: [req.params.id] })
        const service = result.rows[0]
        if (!service) return res.status(404).json({ error: 'Service non trouvé' })
        service.form_fields = safeParseJSON(service.form_fields, [])
        return res.json(service)
      } catch (err) {
        console.error('Erreur Turso GET service:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ? AND active = 1').get(req.params.id)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })
    service.form_fields = safeParseJSON(service.form_fields, [])
    res.json(service)
  })

  // ---- POST /requests ----
  router.post('/requests', authRequired, async (req, res) => {
    const { service_id, form_data } = req.body
    const { tenantId } = req.user

    if (!service_id || form_data == null) {
      return res.status(400).json({ error: 'service_id et form_data obligatoires' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const serviceResult = await tursoDb.execute({ sql: 'SELECT * FROM service_catalog WHERE id = ? AND active = 1', args: [service_id] })
        const service = serviceResult.rows[0]
        if (!service) return res.status(404).json({ error: 'Service non trouvé' })

        const formDataStr = typeof form_data === 'string' ? form_data : JSON.stringify(form_data)
        const requiresApproval = Boolean(service.requires_approval)
        const initialStatus = requiresApproval ? 'pending_approval' : 'approved'
        const approvedAt = requiresApproval ? null : formatLocalDateTime()

        const insertResult = await tursoDb.execute({
          sql: `INSERT INTO service_requests (service_id, requester_id, form_data, status, approved_at) VALUES (?, ?, ?, ?, ?)`,
          args: [service_id, req.user.id, formDataStr, initialStatus, approvedAt]
        })
        const requestId = Number(insertResult.lastInsertRowid)

        if (!requiresApproval) {
          await createTicketFromRequestTurso(tursoDb, requestId, service, req.user, logAction)
        }

        logAction(req.user.id, req.user.name, 'create', 'service_request', requestId, `Demande : ${service.name} [Turso]`)
        const newReqResult = await tursoDb.execute({ sql: 'SELECT * FROM service_requests WHERE id = ?', args: [requestId] })
        return res.status(201).json(newReqResult.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST request:', err)
        return res.status(500).json({ error: 'Erreur lors de la création' })
      }
    }

    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ? AND active = 1').get(service_id)
    if (!service) return res.status(404).json({ error: 'Service non trouvé' })

    const formDataStr = typeof form_data === 'string' ? form_data : JSON.stringify(form_data)
    const requiresApproval = Boolean(service.requires_approval)
    const initialStatus = requiresApproval ? 'pending_approval' : 'approved'
    const approvedAt = requiresApproval ? null : formatLocalDateTime()

    const result = db.prepare(`INSERT INTO service_requests (service_id, requester_id, form_data, status, approved_at) VALUES (?, ?, ?, ?, ?)`).run(service_id, req.user.id, formDataStr, initialStatus, approvedAt)
    const requestId = result.lastInsertRowid

    if (!requiresApproval) {
      createTicketFromRequest(db, requestId, service, req.user, logAction)
    }

    logAction(req.user.id, req.user.name, 'create', 'service_request', requestId, `Demande : ${service.name}`)
    const newRequest = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    res.status(201).json(newRequest)
  })

  // ---- GET /my-requests ----
  router.get('/my-requests', authRequired, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({
          sql: `SELECT sr.*, sc.name as service_name, sc.icon as service_icon, sc.color as service_color, sc.category as service_category, u.name as approved_by_name, t.title as ticket_title, t.status as ticket_status FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u ON sr.approved_by = u.id LEFT JOIN tickets t ON sr.ticket_id = t.id WHERE sr.requester_id = ? ORDER BY sr.created_at DESC`,
          args: [req.user.id]
        })
        const requests = result.rows.map(r => ({ ...r, form_data: safeParseJSON(r.form_data, {}) }))
        return res.json(requests)
      } catch (err) {
        console.error('Erreur Turso GET my-requests:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    const requests = db.prepare(`SELECT sr.*, sc.name as service_name, sc.icon as service_icon, sc.color as service_color, sc.category as service_category, u.name as approved_by_name, t.title as ticket_title, t.status as ticket_status FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u ON sr.approved_by = u.id LEFT JOIN tickets t ON sr.ticket_id = t.id WHERE sr.requester_id = ? ORDER BY sr.created_at DESC`).all(req.user.id)
    for (const r of requests) r.form_data = safeParseJSON(r.form_data, {})
    res.json(requests)
  })

  // ---- GET /requests/:id ----
  router.get('/requests/:id', authRequired, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({
          sql: `SELECT sr.*, sc.name as service_name, sc.description as service_description, sc.icon as service_icon, sc.color as service_color, sc.category as service_category, sc.sla_hours, sc.form_fields as service_form_fields, u_req.name as requester_name, u_req.email as requester_email, u_app.name as approved_by_name, t.id as ticket_id, t.title as ticket_title, t.status as ticket_status FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u_req ON sr.requester_id = u_req.id LEFT JOIN users u_app ON sr.approved_by = u_app.id LEFT JOIN tickets t ON sr.ticket_id = t.id WHERE sr.id = ?`,
          args: [req.params.id]
        })
        const request = result.rows[0]
        if (!request) return res.status(404).json({ error: 'Demande non trouvée' })
        if (request.requester_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' })
        request.form_data = safeParseJSON(request.form_data, {})
        request.service_form_fields = safeParseJSON(request.service_form_fields, [])
        return res.json(request)
      } catch (err) {
        console.error('Erreur Turso GET request:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    const request = db.prepare(`SELECT sr.*, sc.name as service_name, sc.description as service_description, sc.icon as service_icon, sc.color as service_color, sc.category as service_category, sc.sla_hours, sc.form_fields as service_form_fields, u_req.name as requester_name, u_req.email as requester_email, u_app.name as approved_by_name, t.id as ticket_id, t.title as ticket_title, t.status as ticket_status FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u_req ON sr.requester_id = u_req.id LEFT JOIN users u_app ON sr.approved_by = u_app.id LEFT JOIN tickets t ON sr.ticket_id = t.id WHERE sr.id = ?`).get(req.params.id)
    if (!request) return res.status(404).json({ error: 'Demande non trouvée' })
    if (request.requester_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' })
    request.form_data = safeParseJSON(request.form_data, {})
    request.service_form_fields = safeParseJSON(request.service_form_fields, [])
    res.json(request)
  })

  // ---- GET /admin/requests ----
  router.get('/admin/requests', authRequired, adminOnly, async (req, res) => {
    const { status } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        let query = `SELECT sr.*, sc.name as service_name, sc.icon as service_icon, sc.color as service_color, u_req.name as requester_name, u_req.email as requester_email, u_app.name as approved_by_name FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u_req ON sr.requester_id = u_req.id LEFT JOIN users u_app ON sr.approved_by = u_app.id WHERE 1=1`
        const args = []
        if (status) { query += ' AND sr.status = ?'; args.push(status) }
        query += ' ORDER BY sr.created_at DESC'
        const result = await tursoDb.execute({ sql: query, args })
        const requests = result.rows.map(r => ({ ...r, form_data: safeParseJSON(r.form_data, {}) }))
        return res.json(requests)
      } catch (err) {
        console.error('Erreur Turso GET admin requests:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    let query = `SELECT sr.*, sc.name as service_name, sc.icon as service_icon, sc.color as service_color, u_req.name as requester_name, u_req.email as requester_email, u_app.name as approved_by_name FROM service_requests sr JOIN service_catalog sc ON sr.service_id = sc.id LEFT JOIN users u_req ON sr.requester_id = u_req.id LEFT JOIN users u_app ON sr.approved_by = u_app.id WHERE 1=1`
    const params = []
    if (status) { query += ' AND sr.status = ?'; params.push(status) }
    query += ' ORDER BY sr.created_at DESC'

    const requests = db.prepare(query).all(...params)
    for (const r of requests) r.form_data = safeParseJSON(r.form_data, {})
    res.json(requests)
  })

  // ---- POST /admin/requests/:id/approve ----
  router.post('/admin/requests/:id/approve', authRequired, adminOnly, async (req, res) => {
    const requestId = parseInt(req.params.id, 10)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const reqResult = await tursoDb.execute({ sql: 'SELECT * FROM service_requests WHERE id = ?', args: [requestId] })
        const request = reqResult.rows[0]
        if (!request) return res.status(404).json({ error: 'Demande non trouvée' })
        if (request.status !== 'pending_approval') return res.status(400).json({ error: 'Demande déjà traitée' })

        await tursoDb.execute({ sql: `UPDATE service_requests SET status = 'approved', approved_by = ?, approved_at = datetime('now', 'localtime') WHERE id = ?`, args: [req.user.id, requestId] })
        
        const serviceRes = await tursoDb.execute({ sql: 'SELECT * FROM service_catalog WHERE id = ?', args: [request.service_id] })
        const service = serviceRes.rows[0]
        const requesterRes = await tursoDb.execute({ sql: 'SELECT id, name, email FROM users WHERE id = ?', args: [request.requester_id] })
        const requester = requesterRes.rows[0]

        await createTicketFromRequestTurso(tursoDb, requestId, service, requester, logAction)
        logAction(req.user.id, req.user.name, 'approve', 'service_request', requestId, 'Demande approuvée [Turso]')
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso approve:', err)
        return res.status(500).json({ error: "Erreur d'approbation" })
      }
    }

    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    if (!request) return res.status(404).json({ error: 'Demande non trouvée' })
    if (request.status !== 'pending_approval') return res.status(400).json({ error: 'Demande déjà traitée' })

    db.prepare(`UPDATE service_requests SET status = 'approved', approved_by = ?, approved_at = datetime('now', 'localtime') WHERE id = ?`).run(req.user.id, requestId)
    const service = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(request.service_id)
    const requester = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(request.requester_id)

    createTicketFromRequest(db, requestId, service, requester, logAction)
    logAction(req.user.id, req.user.name, 'approve', 'service_request', requestId, 'Demande approuvée')
    res.json({ success: true })
  })

  // ---- POST /admin/requests/:id/reject ----
  router.post('/admin/requests/:id/reject', authRequired, adminOnly, async (req, res) => {
    const requestId = parseInt(req.params.id, 10)
    const { reason } = req.body
    const { tenantId } = req.user
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Motif obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const reqResult = await tursoDb.execute({ sql: 'SELECT * FROM service_requests WHERE id = ?', args: [requestId] })
        const request = reqResult.rows[0]
        if (!request) return res.status(404).json({ error: 'Demande non trouvée' })
        if (request.status !== 'pending_approval') return res.status(400).json({ error: 'Demande déjà traitée' })

        await tursoDb.execute({ sql: `UPDATE service_requests SET status = 'rejected', approved_by = ?, approved_at = datetime('now', 'localtime'), rejection_reason = ? WHERE id = ?`, args: [req.user.id, reason.trim(), requestId] })
        logAction(req.user.id, req.user.name, 'reject', 'service_request', requestId, 'Refusée [Turso]')
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso reject:', err)
        return res.status(500).json({ error: 'Erreur' })
      }
    }

    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
    if (!request) return res.status(404).json({ error: 'Non trouvée' })
    if (request.status !== 'pending_approval') return res.status(400).json({ error: 'Demande déjà traitée' })

    db.prepare(`UPDATE service_requests SET status = 'rejected', approved_by = ?, approved_at = datetime('now', 'localtime'), rejection_reason = ? WHERE id = ?`).run(req.user.id, reason.trim(), requestId)
    logAction(req.user.id, req.user.name, 'reject', 'service_request', requestId, 'Refusée')
    res.json({ success: true })
  })

  // ---- CRUD Admin Services ----
  router.get('/admin/services', authRequired, adminOnly, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute(`SELECT sc.*, (SELECT COUNT(*) FROM service_requests WHERE service_id = sc.id) as request_count FROM service_catalog sc ORDER BY sc.category ASC, sc.name ASC`)
        const services = result.rows.map(s => ({ ...s, form_fields: safeParseJSON(s.form_fields, []) }))
        return res.json(services)
      } catch (err) {
        console.error('Erreur Turso GET admin services:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    const services = db.prepare(`SELECT sc.*, (SELECT COUNT(*) FROM service_requests WHERE service_id = sc.id) as request_count FROM service_catalog sc ORDER BY sc.category ASC, sc.name ASC`).all()
    for (const s of services) s.form_fields = safeParseJSON(s.form_fields, [])
    res.json(services)
  })

  router.post('/admin/services', authRequired, adminOnly, async (req, res) => {
    const { tenantId } = req.user
    const { name, description, category, icon, color, form_fields, sla_hours, requires_approval, approver_role } = req.body
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom obligatoire' })
    const formFieldsStr = typeof form_fields === 'string' ? form_fields : JSON.stringify(form_fields || [])

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO service_catalog (name, description, category, icon, color, form_fields, sla_hours, requires_approval, approver_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [name.trim(), description?.trim() || null, category || null, icon || 'Package', color || 'blue', formFieldsStr, sla_hours ?? 24, requires_approval ? 1 : 0, approver_role || 'admin']
        })
        return res.status(201).json({ id: Number(result.lastInsertRowid), success: true })
      } catch (err) {
        console.error('Erreur Turso POST admin service:', err)
        return res.status(500).json({ error: 'Erreur de création' })
      }
    }

    const result = db.prepare(`INSERT INTO service_catalog (name, description, category, icon, color, form_fields, sla_hours, requires_approval, approver_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name.trim(), description?.trim() || null, category || null, icon || 'Package', color || 'blue', formFieldsStr, sla_hours ?? 24, requires_approval ? 1 : 0, approver_role || 'admin')
    res.status(201).json({ id: result.lastInsertRowid, success: true })
  })

  router.patch('/admin/services/:id', authRequired, adminOnly, async (req, res) => {
    const { tenantId } = req.user
    const targetId = parseInt(req.params.id, 10)
    const allowed = ['name', 'description', 'category', 'icon', 'color', 'form_fields', 'sla_hours', 'requires_approval', 'approver_role', 'active']
    const updates = []; const args = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'form_fields') args.push(typeof req.body[field] === 'string' ? req.body[field] : JSON.stringify(req.body[field]))
        else if (field === 'requires_approval' || field === 'active') args.push(req.body[field] ? 1 : 0)
        else args.push(req.body[field])
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    updates.push(`updated_at = datetime('now', 'localtime')`); args.push(targetId)

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        await tursoDb.execute({ sql: `UPDATE service_catalog SET ${updates.join(', ')} WHERE id = ?`, args })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso PATCH admin service:', err)
        return res.status(500).json({ error: 'Erreur de mise à jour' })
      }
    }

    db.prepare(`UPDATE service_catalog SET ${updates.join(', ')} WHERE id = ?`).run(...args)
    res.json({ success: true })
  })

  router.delete('/admin/services/:id', authRequired, adminOnly, async (req, res) => {
    const { tenantId } = req.user
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      try {
        await tursoDb.execute({ sql: 'UPDATE service_catalog SET active = 0 WHERE id = ?', args: [req.params.id] })
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE admin service:', err)
        return res.status(500).json({ error: 'Erreur de suppression' })
      }
    }
    db.prepare('UPDATE service_catalog SET active = 0 WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  })

  return router
}

// ==================== CRÉATION TICKET (SQLITE LOCAL) ====================
function createTicketFromRequest(db, requestId, service, requester, logAction) {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId)
  if (!request || request.ticket_id) return

  const formData = safeParseJSON(request.form_data, {})
  const description = `**Demande via le catalogue** : ${service.name}\n\n**Détails :**\n${Object.entries(formData).map(([k, v]) => `- **${k}** : ${v}`).join('\n')}`
  const priority = getPriorityFromSlaHours(service.sla_hours)

  const result = db.prepare(`INSERT INTO tickets (title, category, priority, description, created_by, creator) VALUES (?, ?, ?, ?, ?, ?)`).run(`[Demande] ${service.name}`, service.category || 'Autre', priority, description, requester.id, requester.name)
  const ticketId = result.lastInsertRowid

  try { applySlaToTicket(db, ticketId, priority) } catch (err) { console.error('Erreur applySlaToTicket:', err) }

  db.prepare('UPDATE service_requests SET ticket_id = ? WHERE id = ?').run(ticketId, requestId)
  if (logAction) logAction(requester.id, requester.name, 'create', 'ticket', ticketId, `Ticket depuis demande #${requestId}`)
  return ticketId
}

// ==================== CRÉATION TICKET (TURSO) ====================
async function createTicketFromRequestTurso(tursoDb, requestId, service, requester, logAction) {
  const reqResult = await tursoDb.execute({ sql: 'SELECT * FROM service_requests WHERE id = ?', args: [requestId] })
  const request = reqResult.rows[0]
  if (!request || request.ticket_id) return

  const formData = safeParseJSON(request.form_data, {})
  const description = `**Demande via le catalogue** : ${service.name}\n\n**Détails :**\n${Object.entries(formData).map(([k, v]) => `- **${k}** : ${v}`).join('\n')}`
  const priority = getPriorityFromSlaHours(service.sla_hours)

  const insertResult = await tursoDb.execute({
    sql: `INSERT INTO tickets (title, category, priority, description, created_by, creator) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`[Demande] ${service.name}`, service.category || 'Autre', priority, description, requester.id, requester.name]
  })
  const ticketId = Number(insertResult.lastInsertRowid)

  try {
    const policyResult = await tursoDb.execute({ sql: 'SELECT * FROM sla_policies WHERE priority = ? AND active = 1', args: [priority] })
    const policy = policyResult.rows[0]
    if (policy) {
      const now = new Date()
      const responseDeadline = new Date(now.getTime() + policy.response_minutes * 60 * 1000)
      const resolutionDeadline = new Date(now.getTime() + policy.resolution_minutes * 60 * 1000)
      await tursoDb.execute({
        sql: 'UPDATE tickets SET sla_response_deadline = ?, sla_resolution_deadline = ? WHERE id = ?',
        args: [formatLocalDateTime(responseDeadline), formatLocalDateTime(resolutionDeadline), ticketId]
      })
    }
  } catch (err) { console.error('Erreur SLA Turso:', err) }

  await tursoDb.execute({ sql: 'UPDATE service_requests SET ticket_id = ? WHERE id = ?', args: [ticketId, requestId] })
  if (logAction) logAction(requester.id, requester.name, 'create', 'ticket', ticketId, `Ticket depuis demande #${requestId} [Turso]`)
  return ticketId
}