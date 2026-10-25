import { Router } from 'express'
import { authRequired, adminOnly } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

// ==================== INITIALISATION DES TABLES ====================

export function initKnowledgeTables(db) {
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

export function userHasPermission(db, userId, userRole, permissionCode) {
  if (userRole === 'admin') return true
  const perm = db.prepare(`SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_code = ?`).get(userId, permissionCode)
  return !!perm
}

async function userHasPermissionTurso(tursoDb, userId, userRole, permissionCode) {
  if (userRole === 'admin') return true
  const result = await tursoDb.execute({
    sql: 'SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_code = ?',
    args: [userId, permissionCode]
  })
  return result.rows.length > 0
}

export function getUserPermissions(db, userId, userRole) {
  if (userRole === 'admin') {
    return db.prepare('SELECT code FROM permissions').all().map(p => p.code)
  }
  return db.prepare(`SELECT permission_code as code FROM user_permissions WHERE user_id = ?`).all(userId).map(p => p.code)
}

// ==================== ROUTES ====================

export function createKnowledgeRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ---- GET /api/kb/categories ----
  router.get('/categories', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const result = await tursoDb.execute(`
          SELECT c.*, (SELECT COUNT(*) FROM kb_articles WHERE category_id = c.id AND status = 'published') as article_count
          FROM kb_categories c WHERE c.active = 1 ORDER BY c.name ASC
        `)
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso GET categories:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const categories = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM kb_articles WHERE category_id = c.id AND status = 'published') as article_count
      FROM kb_categories c WHERE c.active = 1 ORDER BY c.name ASC
    `).all()
    res.json(categories)
  })

  // ---- GET /api/kb/articles ----
  router.get('/articles', async (req, res) => {
    const { category_id, status, search, known_error, limit = 50, offset = 0 } = req.query
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let query = `
          SELECT a.id, a.title, a.summary, a.category_id, a.tags, a.status, a.is_known_error,
                 a.author_id, a.author_name, a.views, a.helpful_yes, a.helpful_no, a.created_at, a.updated_at,
                 c.name as category_name, c.icon as category_icon, c.color as category_color
          FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE 1=1
        `
        const args = []

        if (req.user.role !== 'admin') {
          query += " AND a.status = 'published'"
        } else if (status) {
          query += ' AND a.status = ?'
          args.push(status)
        }
        if (category_id) { query += ' AND a.category_id = ?'; args.push(category_id) }
        if (known_error === 'true') { query += ' AND a.is_known_error = 1' }
        if (search) {
          query += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
          const s = `%${search}%`
          args.push(s, s, s, s)
        }

        query += ' ORDER BY a.updated_at DESC, a.created_at DESC LIMIT ? OFFSET ?'
        args.push(parseInt(limit), parseInt(offset))

        const result = await tursoDb.execute({ sql: query, args })

        let countQuery = 'SELECT COUNT(*) as c FROM kb_articles a WHERE 1=1'
        const countArgs = []
        if (req.user.role !== 'admin') countQuery += " AND a.status = 'published'"
        else if (status) { countQuery += ' AND a.status = ?'; countArgs.push(status) }
        if (category_id) { countQuery += ' AND a.category_id = ?'; countArgs.push(category_id) }
        if (known_error === 'true') countQuery += ' AND a.is_known_error = 1'
        if (search) {
          countQuery += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
          const s = `%${search}%`
          countArgs.push(s, s, s, s)
        }
        const countResult = await tursoDb.execute({ sql: countQuery, args: countArgs })

        return res.json({ articles: result.rows, total: countResult.rows[0].c })
      } catch (err) {
        console.error('Erreur Turso GET articles:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    let query = `
      SELECT a.id, a.title, a.summary, a.category_id, a.tags, a.status, a.is_known_error,
             a.author_id, a.author_name, a.views, a.helpful_yes, a.helpful_no, a.created_at, a.updated_at,
             c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE 1=1
    `
    const params = []
    if (req.user.role !== 'admin') query += " AND a.status = 'published'"
    else if (status) { query += ' AND a.status = ?'; params.push(status) }
    if (category_id) { query += ' AND a.category_id = ?'; params.push(category_id) }
    if (known_error === 'true') query += ' AND a.is_known_error = 1'
    if (search) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s)
    }
    query += ' ORDER BY a.updated_at DESC, a.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const articles = db.prepare(query).all(...params)
    let countQuery = 'SELECT COUNT(*) as c FROM kb_articles a WHERE 1=1'
    const countParams = []
    if (req.user.role !== 'admin') countQuery += " AND a.status = 'published'"
    else if (status) { countQuery += ' AND a.status = ?'; countParams.push(status) }
    if (category_id) { countQuery += ' AND a.category_id = ?'; countParams.push(category_id) }
    if (known_error === 'true') countQuery += ' AND a.is_known_error = 1'
    if (search) {
      countQuery += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.tags LIKE ?)'
      const s = `%${search}%`
      countParams.push(s, s, s, s)
    }
    const total = db.prepare(countQuery).get(...countParams).c
    res.json({ articles, total })
  })

  // ---- GET /api/kb/articles/:id ----
  router.get('/articles/:id', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const articleResult = await tursoDb.execute({
          sql: `SELECT a.*, c.name as category_name, c.icon as category_icon, c.color as category_color
                FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE a.id = ?`,
          args: [req.params.id]
        })
        const article = articleResult.rows[0]
        if (!article) return res.status(404).json({ error: 'Article non trouvé' })
        if (article.status !== 'published' && req.user.role !== 'admin') return res.status(403).json({ error: 'Article non accessible' })

        if (article.author_id !== req.user.id) {
          await tursoDb.execute({ sql: 'UPDATE kb_articles SET views = views + 1 WHERE id = ?', args: [req.params.id] })
          article.views += 1
        }

        const ticketsResult = await tursoDb.execute({
          sql: `SELECT t.id, t.title, t.status, t.priority FROM kb_article_tickets at JOIN tickets t ON at.ticket_id = t.id WHERE at.article_id = ? ORDER BY at.linked_at DESC LIMIT 20`,
          args: [req.params.id]
        })

        const voteResult = await tursoDb.execute({
          sql: 'SELECT helpful FROM kb_votes WHERE article_id = ? AND user_id = ?',
          args: [req.params.id, req.user.id]
        })

        const historyResult = await tursoDb.execute({
          sql: 'SELECT id, changed_by_name, changed_at FROM kb_article_history WHERE article_id = ? ORDER BY id DESC LIMIT 10',
          args: [req.params.id]
        })

        article.workaround = decrypt(article.workaround)
        return res.json({
          ...article,
          linked_tickets: ticketsResult.rows,
          user_vote: voteResult.rows[0] ? voteResult.rows[0].helpful : null,
          history: historyResult.rows,
        })
      } catch (err) {
        console.error('Erreur Turso GET article:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const article = db.prepare(`
      SELECT a.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE a.id = ?
    `).get(req.params.id)

    if (!article) return res.status(404).json({ error: 'Article non trouvé' })
    if (article.status !== 'published' && req.user.role !== 'admin') return res.status(403).json({ error: 'Article non accessible' })

    if (article.author_id !== req.user.id) {
      db.prepare('UPDATE kb_articles SET views = views + 1 WHERE id = ?').run(req.params.id)
      article.views += 1
    }

    const linkedTickets = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority FROM kb_article_tickets at
      JOIN tickets t ON at.ticket_id = t.id WHERE at.article_id = ? ORDER BY at.linked_at DESC LIMIT 20
    `).all(req.params.id)

    const userVote = db.prepare(`SELECT helpful FROM kb_votes WHERE article_id = ? AND user_id = ?`).get(req.params.id, req.user.id)
    const history = db.prepare(`SELECT id, changed_by_name, changed_at FROM kb_article_history WHERE article_id = ? ORDER BY id DESC LIMIT 10`).all(req.params.id)

    article.workaround = decrypt(article.workaround)
    res.json({ ...article, linked_tickets: linkedTickets, user_vote: userVote ? userVote.helpful : null, history })
  })

  // ---- POST /api/kb/articles ----
  router.post('/articles', async (req, res) => {
    const { title, content, summary, category_id, tags, status, is_known_error, workaround } = req.body
    const { tenantId } = req.user

    if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est obligatoire' })
    if (!content || !content.trim()) return res.status(400).json({ error: 'Le contenu est obligatoire' })

    const encryptedWorkaround = workaround ? encrypt(workaround.trim()) : null

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'kb.write')) {
          return res.status(403).json({ error: 'Permission kb.write requise' })
        }

        let finalStatus = status || 'published'
        if (finalStatus === 'published') {
          if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'kb.publish')) finalStatus = 'draft'
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO kb_articles (title, content, summary, category_id, tags, status, is_known_error, workaround, author_id, author_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [title.trim(), content.trim(), summary?.trim() || null, category_id || null, tags?.trim() || null,
                 finalStatus, is_known_error ? 1 : 0, encryptedWorkaround, req.user.id, req.user.name]
        })

        const newId = Number(result.lastInsertRowid)
        logAction(req.user.id, req.user.name, 'create', 'kb_article', newId, `Article créé : ${title}`)

        const newArticle = await tursoDb.execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [newId] })
        return res.status(201).json(newArticle.rows[0])
      } catch (err) {
        console.error('Erreur Turso POST article:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const canWrite = userHasPermission(db, req.user.id, req.user.role, 'kb.write')
    if (!canWrite) return res.status(403).json({ error: 'Permission kb.write requise' })

    let finalStatus = status || 'published'
    if (finalStatus === 'published') {
      const canPublish = userHasPermission(db, req.user.id, req.user.role, 'kb.publish')
      if (!canPublish) finalStatus = 'draft'
    }

    const result = db.prepare(`
      INSERT INTO kb_articles (title, content, summary, category_id, tags, status, is_known_error, workaround, author_id, author_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), content.trim(), summary?.trim() || null, category_id || null, tags?.trim() || null,
           finalStatus, is_known_error ? 1 : 0, encryptedWorkaround, req.user.id, req.user.name)

    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(result.lastInsertRowid)
    logAction(req.user.id, req.user.name, 'create', 'kb_article', article.id, `Article créé : ${article.title}`)
    res.status(201).json(article)
  })

  // ---- PATCH /api/kb/articles/:id ----
  router.patch('/articles/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { title, content, summary, category_id, tags, status, is_known_error, workaround } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [targetId] })
        const article = check.rows[0]
        if (!article) return res.status(404).json({ error: 'Article non trouvé' })

        const canWrite = await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'kb.write')
        const isAuthor = article.author_id === req.user.id
        const isAdmin = req.user.role === 'admin'
        if (!isAdmin && !isAuthor && !canWrite) return res.status(403).json({ error: 'Permission requise' })

        if (content !== undefined && content !== article.content) {
          await tursoDb.execute({
            sql: `INSERT INTO kb_article_history (article_id, old_content, new_content, changed_by_id, changed_by_name) VALUES (?, ?, ?, ?, ?)`,
            args: [targetId, article.content, content, req.user.id, req.user.name]
          })
        }

        let finalStatus = status !== undefined ? status : article.status
        if (status === 'published' && article.status !== 'published') {
          if (!await userHasPermissionTurso(tursoDb, req.user.id, req.user.role, 'kb.publish') && !isAdmin) finalStatus = 'draft'
        }

        const encryptedWorkaround = workaround?.trim() ? encrypt(workaround.trim()) : null

        await tursoDb.execute({
          sql: `UPDATE kb_articles SET
                  title = COALESCE(?, title), content = COALESCE(?, content), summary = COALESCE(?, summary),
                  category_id = COALESCE(?, category_id), tags = COALESCE(?, tags), status = ?,
                  is_known_error = COALESCE(?, is_known_error), workaround = COALESCE(?, workaround),
                  updated_at = datetime('now', 'localtime')
                WHERE id = ?`,
          args: [title?.trim() || null, content?.trim() || null, summary?.trim() || null,
                 category_id !== undefined ? category_id : null, tags?.trim() || null, finalStatus,
                 is_known_error !== undefined ? (is_known_error ? 1 : 0) : null, encryptedWorkaround, targetId]
        })

        logAction(req.user.id, req.user.name, 'update', 'kb_article', targetId, `Article modifié`)
        const updated = await tursoDb.execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [targetId] })
        return res.json(updated.rows[0])
      } catch (err) {
        console.error('Erreur Turso PATCH article:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const canWrite = userHasPermission(db, req.user.id, req.user.role, 'kb.write')
    const isAuthor = article.author_id === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isAdmin && !isAuthor && !canWrite) return res.status(403).json({ error: 'Permission requise' })

    if (content !== undefined && content !== article.content) {
      db.prepare(`INSERT INTO kb_article_history (article_id, old_content, new_content, changed_by_id, changed_by_name) VALUES (?, ?, ?, ?, ?)`)
        .run(targetId, article.content, content, req.user.id, req.user.name)
    }

    let finalStatus = status !== undefined ? status : article.status
    if (status === 'published' && article.status !== 'published') {
      const canPublish = userHasPermission(db, req.user.id, req.user.role, 'kb.publish')
      if (!canPublish && !isAdmin) finalStatus = 'draft'
    }

    const encryptedWorkaround = workaround?.trim() ? encrypt(workaround.trim()) : null

    db.prepare(`
      UPDATE kb_articles SET
        title = COALESCE(?, title), content = COALESCE(?, content), summary = COALESCE(?, summary),
        category_id = COALESCE(?, category_id), tags = COALESCE(?, tags), status = ?,
        is_known_error = COALESCE(?, is_known_error), workaround = COALESCE(?, workaround),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(title?.trim() || null, content?.trim() || null, summary?.trim() || null,
           category_id !== undefined ? category_id : null, tags?.trim() || null, finalStatus,
           is_known_error !== undefined ? (is_known_error ? 1 : 0) : null, encryptedWorkaround, targetId)

    const updated = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)
    logAction(req.user.id, req.user.name, 'update', 'kb_article', targetId, `Article modifié : ${updated.title}`)
    res.json(updated)
  })

  // ---- DELETE /api/kb/articles/:id ----
  router.delete('/articles/:id', async (req, res) => {
    const targetId = parseInt(req.params.id)
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const check = await tursoDb.execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [targetId] })
        const article = check.rows[0]
        if (!article) return res.status(404).json({ error: 'Article non trouvé' })

        const isAuthor = article.author_id === req.user.id
        const isAdmin = req.user.role === 'admin'
        if (!isAdmin && !isAuthor) return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet article' })

        await tursoDb.execute({ sql: 'DELETE FROM kb_articles WHERE id = ?', args: [targetId] })
        logAction(req.user.id, req.user.name, 'delete', 'kb_article', targetId, `Article supprimé`)
        return res.json({ success: true })
      } catch (err) {
        console.error('Erreur Turso DELETE article:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(targetId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const isAuthor = article.author_id === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isAdmin && !isAuthor) return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet article' })

    db.prepare('DELETE FROM kb_articles WHERE id = ?').run(targetId)
    logAction(req.user.id, req.user.name, 'delete', 'kb_article', targetId, `Article supprimé : ${article.title}`)
    res.json({ success: true })
  })

  // ---- POST /api/kb/articles/:id/vote ----
  router.post('/articles/:id/vote', async (req, res) => {
    const articleId = parseInt(req.params.id)
    const { helpful } = req.body
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const articleCheck = await tursoDb.execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [articleId] })
        if (articleCheck.rows.length === 0) return res.status(404).json({ error: 'Article non trouvé' })

        const existing = await tursoDb.execute({
          sql: 'SELECT * FROM kb_votes WHERE article_id = ? AND user_id = ?',
          args: [articleId, req.user.id]
        })

        if (existing.rows.length > 0) {
          const vote = existing.rows[0]
          if (vote.helpful === (helpful ? 1 : 0)) {
            await tursoDb.execute({ sql: 'DELETE FROM kb_votes WHERE id = ?', args: [vote.id] })
            await tursoDb.execute({
              sql: `UPDATE kb_articles SET helpful_yes = helpful_yes - ?, helpful_no = helpful_no - ? WHERE id = ?`,
              args: [helpful ? 1 : 0, helpful ? 0 : 1, articleId]
            })
            return res.json({ action: 'removed' })
          } else {
            await tursoDb.execute({
              sql: `UPDATE kb_votes SET helpful = ?, voted_at = datetime('now', 'localtime') WHERE id = ?`,
              args: [helpful ? 1 : 0, vote.id]
            })
            await tursoDb.execute({
              sql: `UPDATE kb_articles SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ? WHERE id = ?`,
              args: [helpful ? 1 : -1, helpful ? -1 : 1, articleId]
            })
            return res.json({ action: 'changed' })
          }
        } else {
          await tursoDb.execute({
            sql: `INSERT INTO kb_votes (article_id, user_id, helpful) VALUES (?, ?, ?)`,
            args: [articleId, req.user.id, helpful ? 1 : 0]
          })
          await tursoDb.execute({
            sql: `UPDATE kb_articles SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ? WHERE id = ?`,
            args: [helpful ? 1 : 0, helpful ? 0 : 1, articleId]
          })
          return res.json({ action: 'created' })
        }
      } catch (err) {
        console.error('Erreur Turso vote:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(articleId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })

    const existing = db.prepare('SELECT * FROM kb_votes WHERE article_id = ? AND user_id = ?').get(articleId, req.user.id)

    if (existing) {
      if (existing.helpful === (helpful ? 1 : 0)) {
        db.prepare('DELETE FROM kb_votes WHERE id = ?').run(existing.id)
        db.prepare(`UPDATE kb_articles SET helpful_yes = helpful_yes - ?, helpful_no = helpful_no - ? WHERE id = ?`)
          .run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
        return res.json({ action: 'removed' })
      } else {
        db.prepare('UPDATE kb_votes SET helpful = ?, voted_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(helpful ? 1 : 0, existing.id)
        db.prepare(`UPDATE kb_articles SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ? WHERE id = ?`)
          .run(helpful ? 1 : -1, helpful ? -1 : 1, articleId)
        return res.json({ action: 'changed' })
      }
    } else {
      db.prepare(`INSERT INTO kb_votes (article_id, user_id, helpful) VALUES (?, ?, ?)`).run(articleId, req.user.id, helpful ? 1 : 0)
      db.prepare(`UPDATE kb_articles SET helpful_yes = helpful_yes + ?, helpful_no = helpful_no + ? WHERE id = ?`)
        .run(helpful ? 1 : 0, helpful ? 0 : 1, articleId)
      return res.json({ action: 'created' })
    }
  })

  // ---- POST /api/kb/articles/:id/link-ticket ----
  router.post('/articles/:id/link-ticket', async (req, res) => {
    const articleId = parseInt(req.params.id)
    const { ticket_id } = req.body
    const { tenantId } = req.user
    if (!ticket_id) return res.status(400).json({ error: 'ticket_id obligatoire' })

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const a = await tursoDb.execute({ sql: 'SELECT id FROM kb_articles WHERE id = ?', args: [articleId] })
        if (a.rows.length === 0) return res.status(404).json({ error: 'Article non trouvé' })
        const t = await tursoDb.execute({ sql: 'SELECT id FROM tickets WHERE id = ?', args: [ticket_id] })
        if (t.rows.length === 0) return res.status(404).json({ error: 'Ticket non trouvé' })

        const existing = await tursoDb.execute({
          sql: 'SELECT id FROM kb_article_tickets WHERE article_id = ? AND ticket_id = ?',
          args: [articleId, ticket_id]
        })
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Déjà lié' })

        await tursoDb.execute({
          sql: `INSERT INTO kb_article_tickets (article_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`,
          args: [articleId, ticket_id, req.user.id, req.user.name]
        })

        logAction(req.user.id, req.user.name, 'link', 'kb_article', articleId, `Article lié au ticket #${ticket_id}`)
        return res.status(201).json({ success: true })
      } catch (err) {
        console.error('Erreur Turso link-ticket:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const article = db.prepare('SELECT id FROM kb_articles WHERE id = ?').get(articleId)
    if (!article) return res.status(404).json({ error: 'Article non trouvé' })
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticket_id)
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' })

    const existing = db.prepare('SELECT id FROM kb_article_tickets WHERE article_id = ? AND ticket_id = ?').get(articleId, ticket_id)
    if (existing) return res.status(409).json({ error: 'Déjà lié' })

    db.prepare(`INSERT INTO kb_article_tickets (article_id, ticket_id, linked_by_id, linked_by_name) VALUES (?, ?, ?, ?)`)
      .run(articleId, ticket_id, req.user.id, req.user.name)

    logAction(req.user.id, req.user.name, 'link', 'kb_article', articleId, `Article lié au ticket #${ticket_id}`)
    res.status(201).json({ success: true })
  })

  // ---- GET /api/kb/suggest ----
  router.get('/suggest', async (req, res) => {
    const { ticket_id } = req.query
    const { tenantId } = req.user
    if (!ticket_id) return res.json([])

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        const ticketResult = await tursoDb.execute({ sql: 'SELECT title, description FROM tickets WHERE id = ?', args: [ticket_id] })
        const ticket = ticketResult.rows[0]
        if (!ticket) return res.json([])

        const text = `${ticket.title} ${ticket.description || ''}`.toLowerCase()
        const words = text.replace(/[^\w\sàâäéèêëïîôöùûüç]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 10)
        if (words.length === 0) return res.json([])

        const whereClause = words.map(() => '(LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ? OR LOWER(a.tags) LIKE ?)').join(' OR ')
        const args = []
        for (const w of words) {
          const s = `%${w}%`
          args.push(s, s, s)
        }

        const result = await tursoDb.execute({
          sql: `SELECT a.id, a.title, a.summary, a.tags, c.name as category_name, c.icon as category_icon, c.color as category_color, a.views, a.helpful_yes, a.is_known_error
                FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id
                WHERE a.status = 'published' AND (${whereClause}) ORDER BY a.views DESC, a.helpful_yes DESC LIMIT 5`,
          args
        })
        return res.json(result.rows)
      } catch (err) {
        console.error('Erreur Turso suggest:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const ticket = db.prepare('SELECT title, description FROM tickets WHERE id = ?').get(ticket_id)
    if (!ticket) return res.json([])

    const text = `${ticket.title} ${ticket.description || ''}`.toLowerCase()
    const words = text.replace(/[^\w\sàâäéèêëïîôöùûüç]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 10)
    if (words.length === 0) return res.json([])

    const whereClause = words.map(() => '(LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ? OR LOWER(a.tags) LIKE ?)').join(' OR ')
    const params = []
    for (const w of words) {
      const s = `%${w}%`
      params.push(s, s, s)
    }

    const suggestions = db.prepare(`
      SELECT a.id, a.title, a.summary, a.tags, c.name as category_name, c.icon as category_icon, c.color as category_color, a.views, a.helpful_yes, a.is_known_error
      FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND (${whereClause}) ORDER BY a.views DESC, a.helpful_yes DESC LIMIT 5
    `).all(...params)

    res.json(suggestions)
  })

  // ---- GET /api/kb/my-permissions ----
  router.get('/my-permissions', async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })

      try {
        let permissions = []
        if (req.user.role === 'admin') {
          const result = await tursoDb.execute('SELECT code FROM permissions')
          permissions = result.rows.map(p => p.code)
        } else {
          const result = await tursoDb.execute({
            sql: 'SELECT permission_code as code FROM user_permissions WHERE user_id = ?',
            args: [req.user.id]
          })
          permissions = result.rows.map(p => p.code)
        }
        return res.json({ permissions })
      } catch (err) {
        console.error('Erreur Turso my-permissions:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const permissions = getUserPermissions(db, req.user.id, req.user.role)
    res.json({ permissions })
  })

  return router
}