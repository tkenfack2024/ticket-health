import { Router } from 'express'
import { authRequired } from './auth.js'
import { decrypt } from './encryption.js'

export function createPortalRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ---- GET /api/portal/my-tickets ----
  // Liste des tickets de l'utilisateur connecté (créés par lui ou assignés à lui)
  router.get('/my-tickets', (req, res) => {
    const { status } = req.query

    let query = `
      SELECT
        t.id, t.title, t.category, t.priority, t.status,
        t.created_at, t.resolved_at,
        t.sla_resolution_deadline,
        u.name as assigned_to_name
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      WHERE t.archived = 0
        AND (t.created_by = ? OR t.assignee = ?)
    `
    const params = [req.user.id, req.user.email]

    if (status === 'open') {
      query += " AND t.status != 'Résolu'"
    } else if (status === 'resolved') {
      query += " AND t.status = 'Résolu'"
    }

    query += ' ORDER BY t.created_at DESC'

    const tickets = db.prepare(query).all(...params)

    // Enrichir avec l'état SLA
    for (const t of tickets) {
      t.sla_status = computeSlaStatusSimple(t)
    }

    res.json(tickets)
  })

  // ---- GET /api/portal/my-tickets/:id ----
  // Détail d'un ticket (accès vérifié)
  router.get('/my-tickets/:id', (req, res) => {
    const ticketId = parseInt(req.params.id)

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
        a.version as asset_version
      FROM tickets t
      LEFT JOIN users u ON t.assignee = u.email
      LEFT JOIN assets a ON t.asset_id = a.id
      WHERE t.id = ?
    `).get(ticketId)

    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    // Vérifier l'accès (user = créateur ou assigné)
    if (ticket.created_by !== req.user.id && ticket.assignee !== req.user.email) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    // Déchiffrer la description
    ticket.description = decrypt(ticket.description)
    ticket.sla_status = computeSlaStatusSimple(ticket)

    // Charger les commentaires
    const comments = db.prepare(`
      SELECT id, author, text, created_at
      FROM comments
      WHERE ticket_id = ?
      ORDER BY id ASC
    `).all(ticketId)

    // Charger les articles KB suggérés
    const suggestions = db.prepare(`
      SELECT
        a.id, a.title, a.summary,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.status = 'published'
      ORDER BY a.views DESC
      LIMIT 3
    `).all()

    res.json({
      ticket,
      comments,
      kb_suggestions: suggestions,
    })
  })

  // ---- POST /api/portal/my-tickets/:id/comment ----
  // Ajouter un commentaire (uniquement sur ses propres tickets)
  router.post('/my-tickets/:id/comment', (req, res) => {
    const ticketId = parseInt(req.params.id)
    const { text } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Le texte est obligatoire' })
    }

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    if (ticket.created_by !== req.user.id && ticket.assignee !== req.user.email) {
      return res.status(403).json({ error: 'Accès refusé' })
    }

    const result = db.prepare(`
      INSERT INTO comments (ticket_id, author, text)
      VALUES (?, ?, ?)
    `).run(ticketId, req.user.name, text.trim())

    const newComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newComment)
  })

  // ---- POST /api/portal/my-tickets/:id/confirm-resolved ----
  // Confirmer la résolution (user)
  router.post('/my-tickets/:id/confirm-resolved', (req, res) => {
    const ticketId = parseInt(req.params.id)

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    if (ticket.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Seul le créateur peut confirmer la résolution' })
    }

    if (ticket.status !== 'Résolu') {
      return res.status(400).json({ error: 'Le ticket n\'est pas encore résolu' })
    }

    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('Clos', ticketId)

    logAction(req.user.id, req.user.name, 'update', 'ticket', ticketId, 'Résolution confirmée par l\'utilisateur')

    res.json({ success: true })
  })

  // ---- GET /api/portal/kb ----
  // Liste des articles KB publiés (accessible aux users)
  router.get('/kb', (req, res) => {
    const { search, category_id } = req.query

    let query = `
      SELECT
        a.id, a.title, a.summary, a.tags, a.views,
        a.helpful_yes, a.helpful_no, a.is_known_error,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.status = 'published'
    `
    const params = []

    if (category_id) {
      query += ' AND a.category_id = ?'
      params.push(category_id)
    }
    if (search) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s)
    }

    query += ' ORDER BY a.views DESC, a.helpful_yes DESC LIMIT 50'

    const articles = db.prepare(query).all(...params)
    res.json(articles)
  })

  // ---- GET /api/portal/kb/:id ----
  // Détail d'un article KB
  router.get('/kb/:id', (req, res) => {
    const article = db.prepare(`
      SELECT
        a.*,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.id = ? AND a.status = 'published'
    `).get(req.params.id)

    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    article.workaround = decrypt(article.workaround)

    // Incrémenter les vues
    db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(req.params.id)
    article.views += 1

    // Vote de l'utilisateur
    const userVote = db.prepare('SELECT helpful FROM kb_votes WHERE article_id = ? AND user_id = ?').get(req.params.id, req.user.id)

    res.json({
      ...article,
      user_vote: userVote ? userVote.helpful : null,
    })
  })

  // ---- POST /api/portal/kb/:id/vote ----
  // Voter sur un article
  router.post('/kb/:id/vote', (req, res) => {
    const articleId = parseInt(req.params.id)
    const { helpful } = req.body

    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(articleId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const existing = db.prepare('SELECT * FROM kb_votes WHERE article_id = ? AND user_id = ?').get(articleId, req.user.id)

    if (existing) {
      if (existing.helpful === (helpful ? 1 : 0)) {
        // Toggle off
        db.prepare('DELETE FROM kb_votes WHERE id = ?').run(existing.id)
        db.prepare(`
          UPDATE kb_articles
          SET helpful_yes = helpful_yes - ?, helpful_no = helpful_no - ?
          WHERE id = ?
        `).run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
        return res.json({ action: 'removed' })
      } else {
        db.prepare('UPDATE kb_votes SET helpful = ?, voted_at = datetime(\'now\', \'localtime\') WHERE id = ?')
          .run(helpful ? 1 : 0, existing.id)
        db.prepare(`
          UPDATE kb_articles
          SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ?
          WHERE id = ?
        `).run(helpful ? 1 : -1, helpful ? -1 : 1, articleId)
        return res.json({ action: 'changed' })
      }
    } else {
      db.prepare('INSERT INTO kb_votes (article_id, user_id, helpful) VALUES (?, ?, ?)')
        .run(articleId, req.user.id, helpful ? 1 : 0)
      db.prepare(`
        UPDATE kb_articles
        SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ?
        WHERE id = ?
      `).run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
      return res.json({ action: 'created' })
    }
  })

  return router
}

// Helper simplifié pour calculer l'état SLA
function computeSlaStatusSimple(ticket) {
  if (!ticket.sla_resolution_deadline) return null
  if (ticket.status === 'Résolu' || ticket.status === 'Clos') return 'respecté'

  const now = Date.now()
  const deadline = new Date(ticket.sla_resolution_deadline).getTime()
  const created = new Date(ticket.created_at).getTime()
  const total = deadline - created
  const elapsed = now - created
  const percent = (elapsed / total) * 100

  if (now > deadline) return 'dépassé'
  if (percent >= 80) return 'menacé'
  return 'ok'
}