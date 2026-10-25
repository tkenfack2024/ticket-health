import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const VERSION = 1

// Clé de chiffrement depuis .env
const KEY_HEX = process.env.ENCRYPTION_KEY
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.warn('⚠️  ENCRYPTION_KEY manquante ou invalide (doit faire 64 caractères hex)')
  console.warn('   Le chiffrement des champs sensibles est DÉSACTIVÉ.')
}

const KEY = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null

// ==================== CHIFFREMENT ====================

export function encrypt(plaintext) {
  if (!plaintext) return null
  if (!KEY) {
    console.warn('⚠️  Chiffrement désactivé : données stockées en clair')
    return plaintext
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

    const encrypted = Buffer.concat([
      cipher.update(String(plaintext), 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    const result = Buffer.concat([
      Buffer.from([VERSION]),
      iv,
      authTag,
      encrypted,
    ])

    return 'ENC:' + result.toString('base64')
  } catch (err) {
    console.error('Erreur chiffrement:', err.message)
    throw err
  }
}

export function decrypt(ciphertext) {
  if (!ciphertext) return null
  if (typeof ciphertext !== 'string') return ciphertext

  // Si ce n'est pas chiffré (anciennes données), retourner tel quel
  if (!ciphertext.startsWith('ENC:')) {
    return ciphertext
  }

  if (!KEY) {
    console.warn('⚠️  Impossible de déchiffrer : clé manquante')
    return '[Données chiffrées — clé manquante]'
  }

  try {
    const raw = Buffer.from(ciphertext.slice(4), 'base64')

    const version = raw[0]
    if (version !== VERSION) {
      throw new Error(`Version de chiffrement non supportée : ${version}`)
    }

    const iv = raw.subarray(1, 1 + IV_LENGTH)
    const authTag = raw.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = raw.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (err) {
    console.error('Erreur déchiffrement:', err.message)
    return '[Erreur de déchiffrement]'
  }
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('ENC:')
}

export function getEncryptionStatus() {
  return {
    enabled: !!KEY,
    algorithm: ALGORITHM,
    keyLength: KEY ? KEY.length * 8 : 0,
  }
}