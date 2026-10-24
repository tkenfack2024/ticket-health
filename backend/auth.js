import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendOTPEmail } from './email.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

export function createAuthRouter(db, logAction) {
  const router = Router()

  // ==================== INSCRIPTION ====================
  router.post('/register', async (req, res) => {
    const { name, email, phone, password, tenantId } = req.body
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' })
    }

    const hash = bcrypt.hashSync(password, 10)

    // --- Mode Turso (Multi-tenant) ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })

      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      
      try {
        const existing = await tursoDb.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [email.toLowerCase().trim()]
        })
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Cet email est déjà utilisé' })
        }

        const result = await tursoDb.execute({
          sql: `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'user')`,
          args: [name.trim(), email.toLowerCase().trim(), phone || null, hash]
        })

        const userResult = await tursoDb.execute({
          sql: 'SELECT id, name, email, phone, role, custom_role FROM users WHERE id = ?',
          args: [result.lastInsertRowid]
        })
        const user = userResult.rows[0]

        logAction(user.id, user.name, 'register', 'user', user.id, `Nouveau compte (${tenantId}) : ${user.email}`)

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: user.name, tenantId: tenantId },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        )

        return res.status(201).json({ user: { ...user, tenantId }, token })
      } catch (err) {
        console.error('Erreur Turso register:', err)
        return res.status(500).json({ error: 'Erreur lors de la création du compte' })
      }
    }

    // --- Mode SQLite (Mono-tenant) ---
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' })
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, 'user')
    `).run(name.trim(), email.toLowerCase().trim(), phone || null, hash)

    const user = db.prepare('SELECT id, name, email, phone, role, custom_role FROM users WHERE id = ?').get(result.lastInsertRowid)
    logAction(user.id, user.name, 'register', 'user', user.id, `Nouveau compte : ${user.email}`)

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({ user, token })
  })

  // ==================== CONNEXION ====================
  router.post('/login', async (req, res) => {
    const { email, password, tenantId } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe obligatoires' })
    }

    // --- Mode Turso (Multi-tenant) ---
    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })

      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      
      try {
        const result = await tursoDb.execute({
          sql: 'SELECT * FROM users WHERE email = ?',
          args: [email.toLowerCase().trim()]
        })
        const user = result.rows[0]

        if (!user || !user.active || !user.password_hash) {
          return res.status(401).json({ error: 'Identifiants invalides' })
        }
        if (!bcrypt.compareSync(password, user.password_hash)) {
          return res.status(401).json({ error: 'Identifiants invalides' })
        }

        logAction(user.id, user.name, 'login', 'user', user.id, `Connexion (${tenantId})`)

        // Calcul des permissions
        let permissions = []
        if (user.role === 'admin') {
          const permsResult = await tursoDb.execute('SELECT code FROM permissions')
          permissions = permsResult.rows.map(p => p.code)
        } else {
          if (user.custom_role) {
            const rolePerms = await tursoDb.execute({
              sql: `SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?`,
              args: [user.custom_role]
            })
            permissions.push(...rolePerms.rows.map(p => p.code))
          }
          const userPerms = await tursoDb.execute({
            sql: 'SELECT permission_code as code FROM user_permissions WHERE user_id = ?',
            args: [user.id]
          })
          permissions.push(...userPerms.rows.map(p => p.code))
          permissions = [...new Set(permissions)]
        }

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: user.name, tenantId: tenantId },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        )

        return res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            custom_role: user.custom_role,
            permissions: permissions,
            isAdmin: user.role === 'admin',
            tenantId: tenantId
          },
          token,
        })
      } catch (err) {
        console.error('Erreur Turso login:', err)
        return res.status(500).json({ error: 'Erreur de connexion' })
      }
    }

    // --- Mode SQLite ---
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Identifiants invalides' })
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Ce compte n a pas de mot de passe' })
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants invalides' })
    }

    logAction(user.id, user.name, 'login', 'user', user.id, 'Connexion par mot de passe')

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    // Calcul des permissions
    let permissions = []
    if (user.role === 'admin') {
      permissions = db.prepare('SELECT code FROM permissions').all().map(p => p.code)
    } else {
      if (user.custom_role) {
        const rolePerms = db.prepare(`
          SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?
        `).all(user.custom_role).map(p => p.code)
        permissions.push(...rolePerms)
      }
      const userPerms = db.prepare('SELECT permission_code as code FROM user_permissions WHERE user_id = ?')
        .all(user.id).map(p => p.code)
      permissions.push(...userPerms)
      permissions = [...new Set(permissions)]
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        custom_role: user.custom_role,
        permissions: permissions,
        isAdmin: user.role === 'admin'
      },
      token,
    })
  })

  // ==================== OTP (laissé tel quel) ====================
  router.post('/request-otp', async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email obligatoire' })

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (!user || !user.active) {
      return res.json({ success: true, message: 'Si le compte existe, un code a été envoyé' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresMinutes = parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '5')
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString()

    db.prepare(`UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?`).run(code, expiresAt, user.id)

    try {
      await sendOTPEmail(user.email, code, user.name)
      logAction(user.id, user.name, 'otp-request', 'user', user.id, 'Code OTP envoyé par email')
      res.json({ success: true, message: 'Code envoyé à votre adresse email' })
    } catch (err) {
      console.error('Erreur envoi email :', err)
      res.status(500).json({ error: 'Impossible d envoyer l email' })
    }
  })

  router.post('/verify-otp', (req, res) => {
    const { email, code } = req.body
    if (!email || !code) return res.status(400).json({ error: 'Email et code obligatoires' })

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (!user) return res.status(401).json({ error: 'Code invalide ou expiré' })

    if (!user.otp_code || user.otp_code !== code.trim()) {
      return res.status(401).json({ error: 'Code invalide ou expiré' })
    }
    if (new Date(user.otp_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Code expiré' })
    }

    db.prepare('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = ?').run(user.id)

    logAction(user.id, user.name, 'login-otp', 'user', user.id, 'Connexion par code OTP')

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      token,
    })
  })

  // ==================== /ME ====================
  router.get('/me', authRequired, async (req, res) => {
    const { tenantId } = req.user

    if (tenantId) {
      const tenant = TENANTS[tenantId]
      if (!tenant) return res.status(404).json({ error: 'Entreprise non trouvée' })
      const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
      
      try {
        const result = await tursoDb.execute({
          sql: 'SELECT id, name, email, phone, role, custom_role, active FROM users WHERE id = ?',
          args: [req.user.id]
        })
        const user = result.rows[0]
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

        let permissions = []
        if (user.role === 'admin') {
          const permsResult = await tursoDb.execute('SELECT code FROM permissions')
          permissions = permsResult.rows.map(p => p.code)
        } else {
          if (user.custom_role) {
            const rolePerms = await tursoDb.execute({
              sql: `SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?`,
              args: [user.custom_role]
            })
            permissions.push(...rolePerms.rows.map(p => p.code))
          }
          const userPerms = await tursoDb.execute({
            sql: 'SELECT permission_code as code FROM user_permissions WHERE user_id = ?',
            args: [user.id]
          })
          permissions.push(...userPerms.rows.map(p => p.code))
          permissions = [...new Set(permissions)]
        }

        return res.json({ ...user, permissions, isAdmin: user.role === 'admin', tenantId })
      } catch (err) {
        console.error('Erreur Turso me:', err)
        return res.status(500).json({ error: 'Erreur de connexion à la base de données' })
      }
    }

    // --- MODE SQLITE ---
    const user = db.prepare('SELECT id, name, email, phone, role, custom_role, active FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    let permissions = []
    if (user.role === 'admin') {
      permissions = db.prepare('SELECT code FROM permissions').all().map(p => p.code)
    } else {
      if (user.custom_role) {
        const rolePerms = db.prepare(`
          SELECT rp.permission_code as code FROM role_permissions rp JOIN roles r ON rp.role_id = r.id WHERE r.name = ?
        `).all(user.custom_role).map(p => p.code)
        permissions.push(...rolePerms)
      }
      const userPerms = db.prepare('SELECT permission_code as code FROM user_permissions WHERE user_id = ?')
        .all(user.id).map(p => p.code)
      permissions.push(...userPerms)
      permissions = [...new Set(permissions)]
    }

    res.json({ ...user, permissions, isAdmin: user.role === 'admin' })
  })

  return router
}

export function authRequired(req, res, next) {
  let header = req.headers.authorization

  if (!header && req.query.token) {
    header = `Bearer ${req.query.token}`
  }

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' })
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
}