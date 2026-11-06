import { Router } from 'express'
import { generateSecret, generate, verify, generateURI } from 'otplib'
import qrcode from 'qrcode'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { authRequired } from './auth.js'
import { encrypt, decrypt } from './encryption.js'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'
import { logActionTurso } from './logger.js'

export function createMfaRouter(db, logAction) {
  const router = Router()
  router.use(authRequired)

  // ==================== GÉNÉRATION DU SECRET & QR CODE ====================
  router.post('/setup', async (req, res) => {
    const { tenantId, id: userId, email, name } = req.user

    try {
      // 1. Générer un secret unique
      const secret = generateSecret()

      // 2. Créer l'URI otpauth pour le QR code
      const otpauth = generateURI({
  issuer: 'HealthTicket',
  label: email,
  secret: secret
})

      // 3. Générer le QR code en Base64
      const qrCodeDataUrl = await qrcode.toDataURL(otpauth)

      // 4. Générer 8 codes de secours (8 caractères hex)
      const recoveryCodes = []
      const recoveryCodesHashed = []
      for (let i = 0; i < 8; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase()
        recoveryCodes.push(code)
        recoveryCodesHashed.push(bcrypt.hashSync(code, 10))
      }

      // 5. Stocker le secret (chiffré) + codes hachés, mais NE PAS ACTIVER
      const encryptedSecret = encrypt(secret)
      const recoveryCodesJson = JSON.stringify(recoveryCodesHashed)

      if (tenantId) {
        const tenant = TENANTS[tenantId]
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        await tursoDb.execute({
          sql: 'UPDATE users SET mfa_secret = ?, mfa_recovery_codes = ?, mfa_enabled = 0 WHERE id = ?',
          args: [encryptedSecret, recoveryCodesJson, userId]
        })
      } else {
        db.prepare('UPDATE users SET mfa_secret = ?, mfa_recovery_codes = ?, mfa_enabled = 0 WHERE id = ?')
          .run(encryptedSecret, recoveryCodesJson, userId)
      }

      return res.json({
        secret,
        qrCode: qrCodeDataUrl,
        recoveryCodes // On les affiche UNE SEULE FOIS à l'utilisateur
      })
    } catch (err) {
      console.error('Erreur MFA setup:', err)
      return res.status(500).json({ error: 'Erreur lors de la configuration MFA' })
    }
  })

  // ==================== VÉRIFICATION & ACTIVATION ====================
  router.post('/verify', async (req, res) => {
    const { code } = req.body
    const { tenantId, id: userId } = req.user

    if (!code) return res.status(400).json({ error: 'Code requis' })

    try {
      let user
      if (tenantId) {
        const tenant = TENANTS[tenantId]
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        const result = await tursoDb.execute({
          sql: 'SELECT mfa_secret FROM users WHERE id = ?',
          args: [userId]
        })
        user = result.rows[0]
      } else {
        user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(userId)
      }

      if (!user || !user.mfa_secret) {
        return res.status(400).json({ error: 'MFA non initialisé' })
      }

      // Déchiffrer le secret
      const secret = decrypt(user.mfa_secret)

      // Vérifier le code (window: 1 pour tolérer 30s de décalage)
      const result = await verify({
  secret: secret,
  token: code,
  window: 1 // La fenêtre de tolérance existe toujours
})
const isValid = result.valid

      if (!isValid) {
        return res.status(400).json({ error: 'Code invalide' })
      }

      // Activer le MFA
      if (tenantId) {
        const tenant = TENANTS[tenantId]
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        await tursoDb.execute({
          sql: 'UPDATE users SET mfa_enabled = 1 WHERE id = ?',
          args: [userId]
        })
        await logActionTurso(tursoDb, userId, req.user.name, 'update', 'user', userId, 'MFA activé')
      } else {
        db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(userId)
        logAction(userId, req.user.name, 'update', 'user', userId, 'MFA activé')
      }

      return res.json({ success: true })
    } catch (err) {
      console.error('Erreur MFA verify:', err)
      return res.status(500).json({ error: 'Erreur lors de la vérification MFA' })
    }
  })

  // ==================== DÉSACTIVER LE MFA ====================
  router.post('/disable', async (req, res) => {
    const { password } = req.body
    const { tenantId, id: userId } = req.user

    if (!password) return res.status(400).json({ error: 'Mot de passe requis' })

    try {
      let user
      if (tenantId) {
        const tenant = TENANTS[tenantId]
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        const result = await tursoDb.execute({
          sql: 'SELECT password_hash FROM users WHERE id = ?',
          args: [userId]
        })
        user = result.rows[0]
      } else {
        user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
      }

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' })
      }

      if (tenantId) {
        const tenant = TENANTS[tenantId]
        const tursoDb = createClient({ url: tenant.url, authToken: tenant.token })
        await tursoDb.execute({
          sql: 'UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery_codes = NULL WHERE id = ?',
          args: [userId]
        })
        await logActionTurso(tursoDb, userId, req.user.name, 'update', 'user', userId, 'MFA désactivé')
      } else {
        db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery_codes = NULL WHERE id = ?').run(userId)
        logAction(userId, req.user.name, 'update', 'user', userId, 'MFA désactivé')
      }

      return res.json({ success: true })
    } catch (err) {
      console.error('Erreur MFA disable:', err)
      return res.status(500).json({ error: 'Erreur lors de la désactivation MFA' })
    }
  })

  return router
}