import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'

// ==================== INITIALISATION DES TABLES ====================

export function initKnowledgeTables(db) {
  // Table des catégories d'articles
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'BookOpen',
      color TEXT DEFAULT 'blue',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // Table des articles
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category_id INTEGER,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
      is_known_error INTEGER NOT NULL DEFAULT 0,
      workaround TEXT,
      author_id INTEGER,
      author_name TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      helpful_yes INTEGER NOT NULL DEFAULT 0,
      helpful_no INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  // Table de l'historique des modifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_article_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      old_content TEXT,
      new_content TEXT,
      changed_by_id INTEGER,
      changed_by_name TEXT,
      changed_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE
    )
  `)

  // Table de liaison articles ↔ tickets
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_article_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by_id INTEGER,
      linked_by_name TEXT,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(article_id, ticket_id),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `)

  // Table des votes (👍 / 👎)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      helpful INTEGER NOT NULL,
      voted_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(article_id, user_id),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // ==================== SEED : catégories par défaut ====================

  const catCount = db.prepare('SELECT COUNT(*) as c FROM kb_categories').get().c
  if (catCount === 0) {
    const defaultCategories = [
      ['Informatique', 'Articles liés à l\'informatique', 'Monitor', 'blue'],
      ['Équipement médical', 'Articles sur le matériel médical', 'HeartPulse', 'red'],
      ['Administratif', 'Articles administratifs', 'FileText', 'slate'],
      ['Infrastructure', 'Réseau, bâtiment, électricité', 'Building2', 'amber'],
      ['Erreurs connues', 'KEDB - Erreurs connues avec workarounds', 'AlertTriangle', 'orange'],
      ['Autre', 'Articles divers', 'BookOpen', 'slate'],
    ]
    const insert = db.prepare('INSERT INTO kb_categories (name, description, icon, color) VALUES (?, ?, ?, ?)')
    for (const c of defaultCategories) insert.run(...c)
    console.log('✅ Catégories KB par défaut créées')
  }
}

// ==================== HELPERS ====================

// Vérifie si un user a une permission (les admins ont tout)
export function userHasPermission(db, userId, userRole, permissionCode) {
  if (userRole === 'admin') return true

  const perm = db.prepare(`
    SELECT 1 FROM user_permissions
    WHERE user_id = ? AND permission_code = ?
  `).get(userId, permissionCode)

  return !!perm
}

// Récupère toutes les permissions d'un user
export function getUserPermissions(db, userId, userRole) {
  if (userRole === 'admin') {
    // Admin : renvoie toutes les permissions existantes
    return db.prepare('SELECT code FROM permissions').all().map(p => p.code)
  }

  return db.prepare(`
    SELECT permission_code as code FROM user_permissions WHERE user_id = ?
  `).all(userId).map(p => p.code)
}

// ==================== ROUTES ====================

export function createKnowledgeRouter(db, logAction) {
  const router = Router()

  router.use(authRequired)

  // ---- GET /api/kb/categories ----
  router.get('/categories', (req, res) => {
    const categories = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM kb_articles WHERE category_id = c.id AND status = 'published') as article_count
      FROM kb_categories c
      WHERE c.active = 1
      ORDER BY c.name ASC
    `).all()
    res.json(categories)
  })

  // ---- GET /api/kb/articles ----
  // Liste des articles avec filtres
  router.get('/articles', (req, res) => {
    const { category_id, status, search, known_error, limit = 50, offset = 0 } = req.query

    let query = `
      SELECT
        a.id, a.title, a.summary, a.category_id, a.tags, a.status,
        a.is_known_error, a.author_id, a.author_name, a.views,
        a.helpful_yes, a.helpful_no, a.created_at, a.updated_at,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE 1=1
    `
    const params = []

    // Filtrage par rôle : les non-admins ne voient que les articles publiés
    if (req.user.role !== 'admin') {
      query += " AND a.status = 'published'"
    } else if (status) {
      query += ' AND a.status = ?'
      params.push(status)
    }

    if (category_id) {
      query += ' AND a.category_id = ?'
      params.push(category_id)
    }
    if (known_error === 'true') {
      query += ' AND a.is_known_error = 1'
    }
    if (search) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s)
    }

    query += ' ORDER BY a.updated_at DESC, a.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const articles = db.prepare(query).all(...params)

    // Compter le total filtré
    let countQuery = 'SELECT COUNT(*) as c FROM kb_articles a WHERE 1=1'
    const countParams = []

    if (req.user.role !== 'admin') {
      countQuery += " AND a.status = 'published'"
    } else if (status) {
      countQuery += ' AND a.status = ?'
      countParams.push(status)
    }
    if (category_id) {
      countQuery += ' AND a.category_id = ?'
      countParams.push(category_id)
    }
    if (known_error === 'true') {
      countQuery += ' AND a.is_known_error = 1'
    }
    if (search) {
      countQuery += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
      const s = `%${search}%`
      countParams.push(s, s, s, s)
    }

    const total = db.prepare(countQuery).get(...countParams).c

    res.json({ articles, total })
  })

  // ---- GET /api/kb/articles/:id ----
  // Détail d'un article + incrémenter les vues
  router.get('/articles/:id', (req, res) => {
    const article = db.prepare(`
      SELECT
        a.*,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.id = ?
    `).get(req.params.id)

    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    // Non-admin ne peut pas voir les brouillons
    if (article.status !== 'published' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Article non accessible' })
    }

    // Incrémenter les vues (sauf pour l'auteur lui-même)
    if (article.author_id !== req.user.id) {
      db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(req.params.id)
      article.views += 1
    }

    // Récupérer les tickets liés
    const linkedTickets = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority
      FROM kb_article_tickets at
      JOIN tickets t ON at.ticket_id = t.id
      WHERE at.article_id = ?
      ORDER BY at.linked_at DESC
      LIMIT 20
    `).all(req.params.id)

    // Vote de l'utilisateur actuel
    const userVote = db.prepare(`
      SELECT helpful FROM kb_votes WHERE article_id = ? AND user_id = ?
    `).get(req.params.id, req.user.id)

    // Historique
    const history = db.prepare(`
      SELECT id, changed_by_name, changed_at
      FROM kb_article_history
      WHERE article_id = ?
      ORDER BY id DESC
      LIMIT 10
    `).all(req.params.id)

    res.json({
      ...article,
      linked_tickets: linkedTickets,
      user_vote: userVote ? userVote.helpful : null,
      history,
    })
  })

  // ---- POST /api/kb/articles ----
  // Créer un article (permission kb.write requise)
  router.post('/articles', (req, res) => {
    // Vérifier la permission kb.write
    const canWrite = userHasPermission(db, req.user.id, req.user.role, 'kb.write')
    if (!canWrite) {
      return res.status(403).json({ error: 'Permission kb.write requise' })
    }

    const { title, content, summary, category_id, tags, status, is_known_error, workaround } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre est obligatoire' })
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu est obligatoire' })
    }

    // Seuls ceux qui ont kb.publish peuvent publier directement
    let finalStatus = status || 'published'
    if (finalStatus === 'published') {
      const canPublish = userHasPermission(db, req.user.id, req.user.role, 'kb.publish')
      if (!canPublish) {
        finalStatus = 'draft'
      }
    }

    const result = db.prepare(`
      INSERT INTO kb_articles (
        title, content, summary, category_id, tags, status,
        is_known_error, workaround, author_id, author_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      content.trim(),
      summary?.trim() || null,
      category_id || null,
      tags?.trim() || null,
      finalStatus,
      is_known_error ? 1 : 0,
      workaround?.trim() || null,
      req.user.id,
      req.user.name
    )

    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(result.lastInsertRowid)

    logAction(req.user.id, req.user.name, 'create', 'kb_article', article.id, `Article créé : ${article.title}`)

    res.status(201).json(article)
  })

  // ---- PATCH /api/kb/articles/:id ----
  // Modifier un article
  router.patch('/articles/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    // Vérifier la permission
    const canWrite = userHasPermission(db, req.user.id, req.user.role, 'kb.write')
    const isAuthor = article.author_id === req.user.id
    const isAdmin = req.user.role === 'admin'

    if (!isAdmin && !isAuthor && !canWrite) {
      return res.status(403).json({ error: 'Permission requise' })
    }

    const { title, content, summary, category_id, tags, status, is_known_error, workaround } = req.body

    // Historique : si le contenu change, on enregistre l'ancien
    if (content !== undefined && content !== article.content) {
      db.prepare(`
        INSERT INTO kb_article_history (article_id, old_content, new_content, changed_by_id, changed_by_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(targetId, article.content, content, req.user.id, req.user.name)
    }

    // Vérifier permission de publication
    let finalStatus = status !== undefined ? status : article.status
    if (status === 'published' && article.status !== 'published') {
      const canPublish = userHasPermission(db, req.user.id, req.user.role, 'kb.publish')
      if (!canPublish && !isAdmin) {
        finalStatus = 'draft'
      }
    }

    db.prepare(`
      UPDATE kb_articles
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          summary = COALESCE(?, summary),
          category_id = COALESCE(?, category_id),
          tags = COALESCE(?, tags),
          status = ?,
          is_known_error = COALESCE(?, is_known_error),
          workaround = COALESCE(?, workaround),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      title?.trim() || null,
      content?.trim() || null,
      summary?.trim() || null,
      category_id !== undefined ? category_id : null,
      tags?.trim() || null,
      finalStatus,
      is_known_error !== undefined ? (is_known_error ? 1 : 0) : null,
      workaround?.trim() || null,
      targetId
    )

    const updated = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)

    logAction(req.user.id, req.user.name, 'update', 'kb_article', targetId, `Article modifié : ${updated.title}`)

    res.json(updated)
  })

  // ---- DELETE /api/kb/articles/:id ----
  // Supprimer un article (admin ou auteur)
  router.delete('/articles/:id', (req, res) => {
    const targetId = parseInt(req.params.id)
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const isAuthor = article.author_id === req.user.id
    const isAdmin = req.user.role === 'admin'

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet article' })
    }

    db.prepare('DELETE FROM kb_articles WHERE id = ?').run(targetId)

    logAction(req.user.id, req.user.name, 'delete', 'kb_article', targetId, `Article supprimé : ${article.title}`)

    res.json({ success: true })
  })

  // ---- POST /api/kb/articles/:id/vote ----
  // Voter 👍 ou 👎
  router.post('/articles/:id/vote', (req, res) => {
    const articleId = parseInt(req.params.id)
    const { helpful } = req.body // true ou false

    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(articleId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    // Vérifier si l'utilisateur a déjà voté
    const existing = db.prepare('SELECT * FROM kb_votes WHERE article_id = ? AND user_id = ?').get(articleId, req.user.id)

    if (existing) {
      // Changer le vote
      if (existing.helpful === (helpful ? 1 : 0)) {
        // Même vote → on annule (toggle)
        db.prepare('DELETE FROM kb_votes WHERE id = ?').run(existing.id)
        db.prepare(`
          UPDATE kb_articles
          SET helpful_yes = helpful_yes - ?,
              helpful_no = helpful_no - ?
          WHERE id = ?
        `).run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
        return res.json({ action: 'removed' })
      } else {
        // Changer le vote
        db.prepare('UPDATE kb_votes SET helpful = ?, voted_at = datetime(\'now\', \'localtime\') WHERE id = ?')
          .run(helpful ? 1 : 0, existing.id)
        db.prepare(`
          UPDATE kb_articles
          SET helpful_yes = helpful_yes + ?,
              helpful_no = helpful_no + ?
          WHERE id = ?
        `).run(helpful ? 1 : -1, helpful ? -1 : 1, articleId)
        return res.json({ action: 'changed' })
      }
    } else {
      // Nouveau vote
      db.prepare(`
        INSERT INTO kb_votes (article_id, user_id, helpful) VALUES (?, ?, ?)
      `).run(articleId, req.user.id, helpful ? 1 : 0)
      db.prepare(`
        UPDATE kb_articles
        SET helpful_yes = helpful_yes + ?,
            helpful_no = helpful_no + ?
        WHERE id = ?
      `).run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
      return res.json({ action: 'created' })
    }
  })

  // ---- POST /api/kb/articles/:id/link-ticket ----
  // Lier un article à un ticket
  router.post('/articles/:id/link-ticket', (req, res) => {
    const articleId = parseInt(req.params.id)
    const { ticket_id } = req.body

    if (!ticket_id) return res.status(400).json({ error: 'ticket_id obligatoire' })

    // Vérifier que l'article et le ticket existent
    const article = db.prepare('SELECT id FROM kb_articles WHERE id = ?').get(articleId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticket_id)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    // Vérifier si déjà lié
    const existing = db.prepare('SELECT id FROM kb_article_tickets WHERE article_id = ? AND ticket_id = ?').get(articleId, ticket_id)
    if (existing) {
      return res.status(409).json({ error: 'Déjà lié' })
    }

    db.prepare(`
      INSERT INTO kb_article_tickets (article_id, ticket_id, linked_by_id, linked_by_name)
      VALUES (?, ?, ?, ?)
    `).run(articleId, ticket_id, req.user.id, req.user.name)

    logAction(req.user.id, req.user.name, 'link', 'kb_article', articleId, `Article lié au ticket #${ticket_id}`)

    res.status(201).json({ success: true })
  })

  // ---- GET /api/kb/articles/suggest ----
  // Suggérer des articles pour un ticket (basé sur le titre/description)
  router.get('/suggest', (req, res) => {
    const { ticket_id } = req.query
    if (!ticket_id) return res.json([])

    const ticket = db.prepare('SELECT title, description FROM tickets WHERE id = ?').get(ticket_id)
    if (!ticket) return res.json([])

    // Extraire les mots-clés (mots > 3 caractères)
    const text = `${ticket.title} ${ticket.description || ''}`.toLowerCase()
    const words = text
      .replace(/[^\w\sàâäéèêëïîôöùûüç]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 10)

    if (words.length === 0) return res.json([])

    // Chercher les articles qui matchent
    const whereClause = words.map(() => '(LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ? OR LOWER(a.tags) LIKE ?)').join(' OR ')
    const params = []
    for (const w of words) {
      const s = `%${w}%`
      params.push(s, s, s)
    }

    const suggestions = db.prepare(`
      SELECT
        a.id, a.title, a.summary, a.tags,
        c.name as category_name, c.icon as category_icon, c.color as category_color,
        a.views, a.helpful_yes, a.is_known_error
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND (${whereClause})
      ORDER BY a.views DESC, a.helpful_yes DESC
      LIMIT 5
    `).all(...params)

    res.json(suggestions)
  })

  // ---- GET /api/kb/my-permissions ----
  // Récupérer mes permissions
  router.get('/my-permissions', (req, res) => {
    const permissions = getUserPermissions(db, req.user.id, req.user.role)
    res.json({ permissions })
  })

  return router
}