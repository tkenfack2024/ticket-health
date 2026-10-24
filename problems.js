import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION ====================

export function initProblemTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      symptoms TEXT,
      root_cause TEXT,
      workaround TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN (
        'new', 'analyzing', 'known_error', 'resolved', 'closed'
      )),
      priority TEXT NOT NULL DEFAULT 'Moyenne',
      category TEXT,
      assigned_to TEXT,
      detected_at TEXT DEFAULT (datetime('now', 'localtime')),
      resolved_at TEXT,
      kb_article_id INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (kb_article_id) REFERENCES kb_articles(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS problem_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by_id INTEGER,
      linked_by_name TEXT,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(problem_id, ticket_id),
      FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `)

  console.log('✅ Tables Problèmes initialisées')
}

// ==================== CONSTANTES ====================

const STATUS_CONFIG = {
  new: { label: 'Nouveau', color: 'blue' },
  analyzing: { label: 'En analyse', color: 'amber' },
  known_error: { label: 'Erreur connue', color: 'orange' },
  resolved: { label: 'Résolu', color: 'green' },
  closed: { label: 'Clos', color: 'slate' },
}

// ==================== ROUTES ====================

export function createProblemRouter(db, logAction) {
  const router = Router()
  router.use(authRequired, adminOnly)

  // ---- GET /api/problems ----
  router.get('/', async (req, res) => {
    const { status, priority, search } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT p.*, (SELECT COUNT(*) FROM problem_tickets WHERE problem_id = p.id) as ticket_count
          FROM problems p WHERE 1=1
        `
        const args = []
        if (status) { query += ' AND p.status = ?'; args.push(status) }
        if (priority) { query += ' AND p.priority = ?'; args.push(priority) }
        if (search) {
          query += ' AND (p.title LIKE ? OR p.symptoms LIKE ?)'
          const s = `%${search}%`
          args.push(s, s)
        }
        query += ` ORDER BY CASE p.status WHEN 'new' THEN 1 WHEN 'analyzing' THEN 2 WHEN 'known_error' THEN 3 WHEN 'resolved' THEN 4 WHEN 'closed' THEN 5 END, p.priority DESC, p.id DESC`

        const result = await tursoDb.execute({ sql: query, args })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET problems:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = `
      SELECT p.*, (SELECT COUNT(*) FROM problem_tickets WHERE problem_id = p.id) as ticket_count
      FROM problems p WHERE 1=1
    `
    const params = []
    if (status) { query += ' AND p.status = ?'; params.push(status) }
    if (priority) { query += ' AND p.priority = ?'; params.push(priority) }
    if (search) {
      query += ' AND (p.title LIKE ? OR p.symptoms LIKE ?)'
      const s = `%${search}%`
      params.push(s, s)
    }
    query += ` ORDER BY CASE p.status WHEN 'new' THEN 1 WHEN 'analyzing' THEN 2 WHEN 'known_error' THEN 3 WHEN 'resolved' THEN 4 WHEN 'closed' THEN 5 END, p.priority DESC, p.id DESC`

    const problems = db.prepare(query).all(...params)
    res.json(problems)
  })

  // ---- GET /api/problems/stats ----
  router.get('/stats', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const totalResult = await tursoDb.execute('SELECT COUNT(*) as c FROM problems')
        const byStatusResult = await tursoDb.execute(`SELECT status, COUNT(*) as count FROM problems GROUP BY status`)
        const byPriorityResult = await tursoDb.execute(`SELECT priority, COUNT(*) as count FROM problems WHERE status NOT IN ('resolved', 'closed') GROUP BY priority`)

        return res.json({
          total: totalResult.rows[0].c,
          by_status: byStatusResult.rows,
          by_priority: byPriorityResult.rows,
        })
      } catch (err) {
        console.error('Erreur Turso GET problems stats:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const total = db.prepare('SELECT COUNT(*) as c FROM problems').get().c
    const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM problems GROUP BY status`).all()
    const byPriority = db.prepare(`SELECT priority, COUNT(*) as count FROM problems WHERE status NOT IN ('resolved', 'closed') GROUP BY priority`).all()

    res.json({ total, by_status: byStatus, by_priority: byPriority })
  })

  // ---- GET /api/problems/:id ----
  router.get('/:id', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const problemResult = await tursoDb.execute({
          sql: `SELECT p.*, kb.title as kb_article_title FROM problems p LEFT JOIN kb_articles kb ON p.kb_article_id = kb.id WHERE p.id = ?`,
          args: [req.params.id]
        })
        const problem = problemResult.rows[0]
        if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })

        problem.workaround = decrypt(problem.workaround)

        const ticketsResult = await tursoDb.execute({
          sql: `
            SELECT t.id, t.title, t.status, t.priority, t.created_at, pt.linked_at, pt.linked_by_name
            FROM problem_tickets pt JOIN tickets t ON pt.ticket_id = t.id
            WHERE pt.problem_id = ? ORDER BY pt.linked_at DESC
          `,
          args: [req.params.id]
        })

        return res.json({ ...problem, tickets: ticketsResult.rows })
      } catch (err) {
        console.error('Erreur Turso GET problem:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const problem = db.prepare(`
      SELECT p.*, kb.title as kb_article_title
      FROM problems p LEFT JOIN kb_articles kb ON p.kb_article_id = kb.id WHERE p.id = ?
    `).get(req.params.id)

    if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })
    problem.workaround = decrypt(problem.workaround)

    const tickets = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.created_at, pt.linked_at, pt.linked_by_name
      FROM problem_tickets pt JOIN tickets t ON pt.ticket_id = t.id
      WHERE pt.problem_id = ? ORDER BY pt.linked_at DESC
    `).all(req.params.id)

    res.json({ ...problem, tickets })
  })

  // ---- POST /api/problems ----
  router.post('/', async (req, res) => {
    const { title, symptoms, root_cause, workaround, priority, category, assigned_to, ticket_ids } = req.body
    const { tenantId } = req.user

    if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est obligatoire' })

    const encryptedWorkaround = workaround ? encrypt(workaround.trim()) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `INSERT INTO problems (title, symptoms, root_cause, workaround, priority, category, assigned_to, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [title.trim(), symptoms?.trim() || null, root_cause?.trim() || null, encryptedWorkaround,
                 priority || 'Moyenne', category?.trim() || null, assigned_to?.trim() || null, req.user.id, req.user.name]
        })

        const problemId = Number(result.lastInsertRowid)

        if (Array.isArray(ticket_ids) && ticket_ids.length > 0) {
          for (const ticketId of ticket_ids) {
            try {
              await tursoDb.execute({
                sql: `INSERT OR IGNORE INTO problem_tickets (problem_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`,
                args: [problemId, ticketId, req.user.id, req.user.name]
              })
            } catch (e) { /* ignore */ }
          }
        }

        logAction(req.user.id, req.user.name, 'create', 'problem', problemId, `Problème créé : ${title} (${ticket_ids?.length || 0} ticket(s) liés)`)

        const newProblem = await tursoDb.execute({ sql: 'SELECT * FROM problems WHERE id = ?', args: [problemId] })
        const problem = newProblem.rows[0]
        problem.workaround = decrypt(problem.workaround)
        return res.status(201).json(problem)
      } catch (err) {
        console.error('Erreur Turso POST problem:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    try {
      const result = db.prepare(`
        INSERT INTO problems (title, symptoms, root_cause, workaround, priority, category, assigned_to, created_by, created_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title.trim(), symptoms?.trim() || null, root_cause?.trim() || null, encryptedWorkaround,
             priority || 'Moyenne', category?.trim() || null, assigned_to?.trim() || null, req.user.id, req.user.name)

      const problemId = result.lastInsertRowid

      if (Array.isArray(ticket_ids) && ticket_ids.length > 0) {
        const linkStmt = db.prepare(`INSERT OR IGNORE INTO problem_tickets (problem_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`)
        for (const ticketId of ticket_ids) linkStmt.run(problemId, ticketId, req.user.id, req.user.name)
      }

      logAction(req.user.id, req.user.name, 'create', 'problem', problemId, `Problème créé : ${title} (${ticket_ids?.length || 0} ticket(s) liés)`)

      const newProblem = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId)
      newProblem.workaround = decrypt(newProblem.workaround)
      res.status(201).json(newProblem)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message })
    }
  })

  // ---- PATCH /api/problems/:id ----
  router.patch('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (req.body.status && !['new', 'analyzing', 'known_error', 'resolved', 'closed'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Statut invalide' })
    }

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const checkResult = await tursoDb.execute({ sql: 'SELECT * FROM problems WHERE id = ?', args: [targetId] })
        const problem = checkResult.rows[0]
        if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })

        const allowed = ['title', 'symptoms', 'root_cause', 'workaround', 'status', 'priority', 'category', 'assigned_to']
        const updates = []
        const args = []

        for (const field of allowed) {
          if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`)
            if (field === 'workaround') args.push(req.body[field] ? encrypt(req.body[field]) : null)
            else args.push(req.body[field] || null)
          }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
        if (req.body.status === 'resolved' && problem.status !== 'resolved') updates.push('resolved_at = datetime(\'now\', \'localtime\')')
        updates.push('updated_at = datetime(\'now\', \'localtime\')')
        args.push(targetId)

        await tursoDb.execute({ sql: `UPDATE problems SET ${updates.join(', ')} WHERE id = ?`, args })

        logAction(req.user.id, req.user.name, 'update', 'problem', targetId, `Problème modifié`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM problems WHERE id = ?', args: [targetId] })
        const p = updated.rows[0]
        p.workaround = decrypt(p.workaround)
        return res.json(p)
      } catch (err) {
        console.error('Erreur Turso PATCH problem:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(targetId)
    if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })

    const allowed = ['title', 'symptoms', 'root_cause', 'workaround', 'status', 'priority', 'category', 'assigned_to']
    const updates = []
    const values = []

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'workaround') values.push(req.body[field] ? encrypt(req.body[field]) : null)
        else values.push(req.body[field] || null)
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
    if (req.body.status === 'resolved' && problem.status !== 'resolved') updates.push('resolved_at = datetime(\'now\', \'localtime\')')
    updates.push('updated_at = datetime(\'now\', \'localtime\')')
    values.push(targetId)

    db.prepare(`UPDATE problems SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(targetId)
    updated.workaround = decrypt(updated.workaround)
    logAction(req.user.id, req.user.name, 'update', 'problem', targetId, `Problème modifié : ${updated.title}`)
    res.json(updated)
  })

  // ---- DELETE /api/problems/:id ----
  router.delete('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const checkResult = await tursoDb.execute({ sql: 'SELECT * FROM problems WHERE id = ?', args: [targetId] })
        const problem = checkResult.rows[0]
        if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })

        await tursoDb.execute({ sql: 'DELETE FROM problems WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'problem', targetId, `Problème supprimé`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE problem:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(targetId)
    if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })

    db.prepare('DELETE FROM problems WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'problem', targetId, `Problème supprimé : ${problem.title}`)
    res.json({ success: true })
  })

  // ---- POST /api/problems/:id/link-ticket ----
  router.post('/:id/link-ticket', async (req, res) => {
    const problemId = parseInt(req.params.id)
    const { ticket_id } = req.body
    const { tenantId } = req.user

    if (!ticket_id) return res.status(400).json({ error: 'ticket_id obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const p = await tursoDb.execute({ sql: 'SELECT id, title FROM problems WHERE id = ?', args: [problemId] })
        if (p.rows.length === 0) return res.status(404).json({ error: 'Problème non trouvé' })
        const t = await tursoDb.execute({ sql: 'SELECT id, title FROM tickets WHERE id = ?', args: [ticket_id] })
        if (t.rows.length === 0) return res.status(404).json({ error: 'Ticket non trouvé' })

        await tursoDb.execute({
          sql: `INSERT INTO problem_tickets (problem_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`,
          args: [problemId, ticket_id, req.user.id, req.user.name]
        })

        logAction(req.user.id, req.user.name, 'link', 'problem', problemId, `Ticket #${ticket_id} lié au problème`)
        return res.status(201).json({ success: true })
      } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ticket déjà lié à ce problème' })
        console.error('Erreur Turso link-ticket:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const problem = db.prepare('SELECT id, title FROM problems WHERE id = ?').get(problemId)
    if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(ticket_id)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    try {
      db.prepare(`INSERT INTO problem_tickets (problem_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`)
        .run(problemId, ticket_id, req.user.id, req.user.name)
      logAction(req.user.id, req.user.name, 'link', 'problem', problemId, `Ticket #${ticket_id} lié au problème "${problem.title}"`)
      res.status(201).json({ success: true })
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ticket déjà lié à ce problème' })
      res.status(500).json({ error: err.message })
    }
  })

  // ---- DELETE /api/problems/:id/unlink-ticket/:ticketId ----
  router.delete('/:id/unlink-ticket/:ticketId', async (req, res) => {
    const problemId = parseInt(req.params.id)
    const ticketId = parseInt(req.params.ticketId)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute({
          sql: `DELETE FROM problem_tickets WHERE problem_id = ? AND ticket_id = ?`,
          args: [problemId, ticketId]
        })

        if (result.rowsAffected === 0) return res.status(404).json({ error: 'Lien non trouvé' })

        logAction(req.user.id, req.user.name, 'unlink', 'problem', problemId, `Ticket #${ticketId} délié`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso unlink-ticket:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const result = db.prepare(`DELETE FROM problem_tickets WHERE problem_id = ? AND ticket_id = ?`).run(problemId, ticketId)
    if (result.changes === 0) return res.status(404).json({ error: 'Lien non trouvé' })
    logAction(req.user.id, req.user.name, 'unlink', 'problem', problemId, `Ticket #${ticketId} délié`)
    res.json({ success: true })
  })

  // ---- POST /api/problems/:id/create-kb ----
  router.post('/:id/create-kb', async (req, res) => {
    const problemId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const checkResult = await tursoDb.execute({ sql: 'SELECT * FROM problems WHERE id = ?', args: [problemId] })
        const problem = checkResult.rows[0]
        if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })
        if (problem.kb_article_id) return res.status(409).json({ error: 'Un article KEDB existe déjà pour ce problème' })

        const workaround = decrypt(problem.workaround)
        if (!workaround) return res.status(400).json({ error: 'Un workaround est requis pour créer un article KEDB' })

        // Trouver ou créer la catégorie "Erreurs connues"
        let categoryResult = await tursoDb.execute({ sql: "SELECT id FROM kb_categories WHERE name = 'Erreurs connues'" })
        let categoryId
        if (categoryResult.rows.length === 0) {
          const catInsert = await tursoDb.execute({
            sql: `INSERT INTO kb_categories (name, description, icon, color) VALUES (?, ?, ?, ?)`,
            args: ['Erreurs connues', 'KEDB - Erreurs connues avec workarounds', 'AlertTriangle', 'orange']
          })
          categoryId = Number(catInsert.lastInsertRowid)
        } else {
          categoryId = categoryResult.rows[0].id
        }

        const content = `## Symptômes\n\n${problem.symptoms || 'Non renseignés'}\n\n## Cause racine\n\n${problem.root_cause || 'En cours d\'analyse'}\n\n## Workaround\n\n${workaround}\n\n## Tickets liés\n\nCe problème est lié à ${(await tursoDb.execute({ sql: 'SELECT COUNT(*) as c FROM problem_tickets WHERE problem_id = ?', args: [problemId] })).rows[0].c} incident(s).\n`

        const kbResult = await tursoDb.execute({
          sql: `INSERT INTO kb_articles (title, content, summary, category_id, tags, status, is_known_error, workaround, author_id, author_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `Problème : ${problem.title}`,
            content,
            problem.symptoms?.substring(0, 200) || 'Erreur connue avec workaround',
            categoryId,
            `probleme,kedb,${problem.category || 'divers'}`,
            'published',
            1,
            encrypt(workaround),
            req.user.id,
            req.user.name
          ]
        })

        const kbArticleId = Number(kbResult.lastInsertRowid)

        await tursoDb.execute({
          sql: `UPDATE problems SET kb_article_id = ?, status = 'known_error', updated_at = datetime('now', 'localtime') WHERE id = ?`,
          args: [kbArticleId, problemId]
        })

        logAction(req.user.id, req.user.name, 'create', 'kb_article', kbArticleId, `Article KEDB créé depuis le problème`)
        return res.status(201).json({ success: true, kb_article_id: kbArticleId })
      } catch (err) {
        console.error('Erreur Turso create-kb:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId)
    if (!problem) return res.status(404).json({ error: 'Problème non trouvé' })
    if (problem.kb_article_id) return res.status(409).json({ error: 'Un article KEDB existe déjà pour ce problème' })

    const workaround = decrypt(problem.workaround)
    if (!workaround) return res.status(400).json({ error: 'Un workaround est requis pour créer un article KEDB' })

    let category = db.prepare('SELECT id FROM kb_categories WHERE name = ?').get('Erreurs connues')
    if (!category) {
      const catResult = db.prepare(`INSERT INTO kb_categories (name, description, icon, color) VALUES (?, ?, ?, ?)`)
        .run('Erreurs connues', 'KEDB - Erreurs connues avec workarounds', 'AlertTriangle', 'orange')
      category = { id: catResult.lastInsertRowid }
    }

    const content = `## Symptômes\n\n${problem.symptoms || 'Non renseignés'}\n\n## Cause racine\n\n${problem.root_cause || 'En cours d\'analyse'}\n\n## Workaround\n\n${workaround}\n\n## Tickets liés\n\nCe problème est lié à ${db.prepare('SELECT COUNT(*) as c FROM problem_tickets WHERE problem_id = ?').get(problemId).c} incident(s).\n`

    const kbResult = db.prepare(`
      INSERT INTO kb_articles (title, content, summary, category_id, tags, status, is_known_error, workaround, author_id, author_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `Problème : ${problem.title}`,
      content,
      problem.symptoms?.substring(0, 200) || 'Erreur connue avec workaround',
      category.id,
      `probleme,kedb,${problem.category || 'divers'}`,
      'published',
      1,
      encrypt(workaround),
      req.user.id,
      req.user.name
    )

    const kbArticleId = kbResult.lastInsertRowid

    db.prepare('UPDATE problems SET kb_article_id = ?, status = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
      .run(kbArticleId, 'known_error', problemId)

    logAction(req.user.id, req.user.name, 'create', 'kb_article', kbArticleId, `Article KEDB créé depuis le problème "${problem.title}"`)
    res.status(201).json({ success: true, kb_article_id: kbArticleId })
  })

  return router
}