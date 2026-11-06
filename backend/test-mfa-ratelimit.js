// backend/test-mfa-ratelimit.js
import 'dotenv/config'

const BASE_URL = 'http://localhost:3001'
const TENANT = 'entreprise-alpha'
const EMAIL = 'admin@entreprise-alpha.local'
const PASSWORD = 'admin123'

async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function run() {
  console.log('🛡️  Test du Rate Limiting MFA\n')

  // Reset + activation MFA
  const login = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
  if (login.data.mfaRequired) {
    console.log('⚠️ MFA déjà actif. Utilise le script de reset d\'abord.')
    return
  }
  const token = login.data.token

  const setup = await apiCall('POST', '/api/auth/mfa/setup', null, token)
  const { generate } = await import('otplib')
  const code = await generate({ secret: setup.data.secret })
  await apiCall('POST', '/api/auth/mfa/verify', { code }, token)
  console.log('✅ MFA activé pour le test\n')

  const login2 = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
  const userId = login2.data.userId

  // 5 échecs
  console.log('🔴 Envoi de 5 mauvais codes TOTP :')
  for (let i = 1; i <= 5; i++) {
    const r = await apiCall('POST', '/api/auth/login/mfa', { userId, tenantId: TENANT, code: '000000' })
    console.log(`   Tentative ${i}: HTTP ${r.status} — ${r.data.error}`)
  }

  // Tentative avec le vrai code (doit être bloquée)
  console.log('\n🔒 Tentative avec le VRAI code (doit être bloquée) :')
  const realCode = await generate({ secret: setup.data.secret })
  const blocked = await apiCall('POST', '/api/auth/login/mfa', { userId, tenantId: TENANT, code: realCode })
  console.log(`   HTTP ${blocked.status} — ${blocked.data.error}`)

  if (blocked.status === 429) {
    console.log('\n🎉 RATE LIMITING FONCTIONNE !')
  } else {
    console.log('\n❌ Rate limiting NE FONCTIONNE PAS.')
  }

  process.exit(0)
}

run()