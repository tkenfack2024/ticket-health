import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendOTPEmail } from './email.js'

export function createAuthRouter(db, logAction) {
  const router = Router()

  router.post('/register', async (req, res) => {
    const { name, email, phone, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' })
    }

    const hash = bcrypt.hashSync(password, 10)
    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, 'user')
    `).run(name.trim(), email.toLowerCase().trim(), phone || null, hash)

    const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(result.lastInsertRowid)
    logAction(user.id, user.name, 'register', 'user', user.id, `Nouveau compte : ${user.email}`)

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({ user, token })
  })

  router.post('/login', (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe obligatoires' })
    }

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

    res.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      token,
    })
  })

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

    db.prepare(`
      UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?
    `).run(code, expiresAt, user.id)

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

  router.get('/me', (req, res) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' })
    }
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
      const user = db.prepare('SELECT id, name, email, phone, role, active FROM users WHERE id = ?').get(payload.id)
      if (!user || !user.active) return res.status(401).json({ error: 'Compte désactivé' })
      res.json(user)
    } catch {
      return res.status(401).json({ error: 'Token invalide' })
    }
  })

  return router
}

export function authRequired(req, res, next) {
  let header = req.headers.authorization

  // Accepte aussi le token en query string (pour les liens de téléchargement)
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
