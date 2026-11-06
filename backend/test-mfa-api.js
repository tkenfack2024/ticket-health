// backend/test-mfa-api.js
// Test complet du MFA via l'API HTTP (aucun accès direct Turso requis)
// Prérequis : le backend doit tourner sur http://localhost:3001

import 'dotenv/config'

const BASE_URL = 'http://localhost:3001'
const TENANT = 'entreprise-alpha'
const EMAIL = 'admin@entreprise-alpha.local'
const PASSWORD = 'admin123'

// Compteurs de résultats
let passed = 0
let failed = 0

// ==================== HELPERS ====================

async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }

  return { status: res.status, data }
}

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ ${message}`)
    passed++
  } else {
    console.log(`   ❌ ${message}`)
    failed++
    throw new Error(`Assertion échouée : ${message}`)
  }
}

function section(title) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  ${title}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

// ==================== TEST ====================

async function runTests() {
  console.log('\n🔐 TEST COMPLET DU MFA — HealthTicket')
  console.log(`   Tenant     : ${TENANT}`)
  console.log(`   Utilisateur: ${EMAIL}`)
  console.log(`   Backend    : ${BASE_URL}\n`)

  let token = null
  let secret = null
  let recoveryCodes = []
  let userId = null
  let totpModule = null

  try {
    // ========== ÉTAPE 1 : Vérifier que le backend répond ==========
    section('ÉTAPE 1 — Connexion au backend')

    const health = await apiCall('GET', '/')
    assert(health.status === 200, `Backend accessible (HTTP ${health.status})`)
    console.log(`   → ${JSON.stringify(health.data)}`)

    // ========== ÉTAPE 2 : Login normal (sans MFA) ==========
    section('ÉTAPE 2 — Connexion initiale (sans MFA)')

    const login1 = await apiCall('POST', '/api/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      tenantId: TENANT,
    })

    if (login1.data.mfaRequired) {
      console.log('\n⚠️  Le MFA est DÉJÀ activé sur ce compte.')
      console.log('   → Soit il a été laissé actif, soit un test précédent a échoué.')
      console.log('   → On va d\'abord le désactiver manuellement via Turso ou un script de secours.')
      console.log('\n   Pour continuer, exécute :')
      console.log('   node -e "import(\'dotenv/config\').then(async () => { const { createClient } = await import(\'@libsql/client\'); const { TENANTS } = await import(\'./tenants.js\'); const t = TENANTS[\'entreprise-alpha\']; const db = createClient({ url: t.url, authToken: t.token }); await db.execute({ sql: \'UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery_codes = NULL WHERE email = ?\', args: [\'admin@entreprise-alpha.local\'] }); console.log(\'✅ MFA réinitialisé\'); process.exit(0); });"')
      process.exit(1)
    }

    assert(login1.status === 200, `Login OK (HTTP ${login1.status})`)
    assert(!!login1.data.token, 'Token JWT reçu')
    token = login1.data.token
    userId = login1.data.user.id
    console.log(`   → Utilisateur ID : ${userId}`)

    // ========== ÉTAPE 3 : Vérifier le statut MFA (doit être désactivé) ==========
    section('ÉTAPE 3 — Statut MFA initial')

    const status1 = await apiCall('GET', '/api/auth/mfa/status', null, token)
    assert(status1.status === 200, `Statut récupéré (HTTP ${status1.status})`)
    assert(status1.data.enabled === false, 'MFA est bien désactivé au départ')

    // ========== ÉTAPE 4 : Setup MFA (génération secret + QR + recovery codes) ==========
    section('ÉTAPE 4 — Setup MFA (QR + secret + recovery codes)')

    const setup = await apiCall('POST', '/api/auth/mfa/setup', null, token)
    assert(setup.status === 200, `Setup OK (HTTP ${setup.status})`)
    assert(!!setup.data.secret, 'Secret TOTP reçu')
    assert(!!setup.data.qrCode, 'QR Code (data URL) reçu')
    assert(Array.isArray(setup.data.recoveryCodes), 'Tableau de recovery codes reçu')
    assert(setup.data.recoveryCodes.length === 8, `8 recovery codes (reçu: ${setup.data.recoveryCodes.length})`)

    secret = setup.data.secret
    recoveryCodes = setup.data.recoveryCodes

    console.log(`   → Secret       : ${secret}`)
    console.log(`   → QR (début)   : ${setup.data.qrCode.slice(0, 60)}...`)
    console.log(`   → Recovery[0]  : ${recoveryCodes[0]}`)
    console.log(`   → Recovery[7]  : ${recoveryCodes[7]}`)

    // ========== ÉTAPE 5 : Vérifier que le MFA est encore désactivé ==========
    section('ÉTAPE 5 — MFA pas encore activé (après setup)')

    const status2 = await apiCall('GET', '/api/auth/mfa/status', null, token)
    assert(status2.status === 200, 'Statut récupéré')
    assert(status2.data.enabled === false, 'MFA toujours désactivé (setup ≠ activation)')

    // ========== ÉTAPE 6 : Générer un code TOTP ==========
    section('ÉTAPE 6 — Génération d\'un code TOTP valide')

    try {
      totpModule = await import('otplib')
    } catch (e) {
      throw new Error('Le module otplib n\'est pas installé. Lance "npm install otplib" dans backend/.')
    }

    const code1 = await totpModule.generate({ secret })
    assert(typeof code1 === 'string' && /^\d{6}$/.test(code1), `Code TOTP généré : ${code1}`)

    // ========== ÉTAPE 7 : Activer le MFA avec le code TOTP ==========
    section('ÉTAPE 7 — Activation du MFA (verify)')

    const verify = await apiCall('POST', '/api/auth/mfa/verify', { code: code1 }, token)
    assert(verify.status === 200, `Activation OK (HTTP ${verify.status})`)
    assert(verify.data.success === true, 'MFA activé (success: true)')

    // ========== ÉTAPE 8 : Vérifier que le MFA est activé ==========
    section('ÉTAPE 8 — Statut MFA activé')

    const status3 = await apiCall('GET', '/api/auth/mfa/status', null, token)
    assert(status3.status === 200, 'Statut récupéré')
    assert(status3.data.enabled === true, 'MFA est bien activé')

    // ========== ÉTAPE 9 : Re-login → doit demander MFA ==========
    section('ÉTAPE 9 — Re-login : MFA obligatoire')

    const login2 = await apiCall('POST', '/api/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      tenantId: TENANT,
    })

    assert(login2.status === 200, `Login accepté (HTTP ${login2.status})`)
    assert(login2.data.mfaRequired === true, 'mfaRequired: true renvoyé')
    assert(!login2.data.token, 'AUCUN token JWT émis avant validation MFA')
    assert(!!login2.data.userId, 'userId renvoyé pour finaliser le MFA')
    assert(login2.data.tenantId === TENANT, 'tenantId renvoyé')

    const mfaUserId = login2.data.userId
    const mfaTenantId = login2.data.tenantId

    // ========== ÉTAPE 10 : Finaliser le login avec un code TOTP ==========
    section('ÉTAPE 10 — Finalisation du login MFA (TOTP)')

    // Attendre un peu pour être sûr d'être dans la même fenêtre (30s)
    // Ou on peut régénérer immédiatement
    const code2 = await totpModule.generate({ secret })

    const loginMfa = await apiCall('POST', '/api/auth/login/mfa', {
      userId: mfaUserId,
      tenantId: mfaTenantId,
      code: code2,
    })

    assert(loginMfa.status === 200, `Login MFA OK (HTTP ${loginMfa.status})`)
    assert(!!loginMfa.data.token, 'Token JWT reçu après MFA')
    assert(loginMfa.data.user.email === EMAIL, 'Utilisateur correct renvoyé')

    const tokenMfa = loginMfa.data.token
    console.log(`   → Connecté en tant que : ${loginMfa.data.user.name} (${loginMfa.data.user.email})`)

    // ========== ÉTAPE 11 : Test d'un MAUVAIS code TOTP ==========
    section('ÉTAPE 11 — Refus d\'un mauvais code TOTP')

    const badLogin = await apiCall('POST', '/api/auth/login/mfa', {
      userId: mfaUserId,
      tenantId: mfaTenantId,
      code: '000000',
    })

    assert(badLogin.status === 401, `Code invalide refusé (HTTP ${badLogin.status})`)
    assert(badLogin.data.error, 'Message d\'erreur renvoyé')

    // ========== ÉTAPE 12 : Test d'un recovery code ==========
    section('ÉTAPE 12 — Login avec un recovery code')

    const recoveryCode = recoveryCodes[0]
    const loginRecovery = await apiCall('POST', '/api/auth/login/mfa', {
      userId: mfaUserId,
      tenantId: mfaTenantId,
      code: recoveryCode,
    })

    assert(loginRecovery.status === 200, `Recovery code accepté (HTTP ${loginRecovery.status})`)
    assert(!!loginRecovery.data.token, 'Token JWT reçu')

    // ========== ÉTAPE 13 : Rejouer le MÊME recovery code → doit échouer ==========
    section('ÉTAPE 13 — Recovery code à usage unique')

    const replayRecovery = await apiCall('POST', '/api/auth/login/mfa', {
      userId: mfaUserId,
      tenantId: mfaTenantId,
      code: recoveryCode,
    })

    assert(replayRecovery.status === 401, `Rejeu refusé (HTTP ${replayRecovery.status})`)
    assert(replayRecovery.data.error, 'Message d\'erreur renvoyé')

    // ========== ÉTAPE 14 : Désactivation via /disable (avec mot de passe) ==========
    section('ÉTAPE 14 — Désactivation par l\'utilisateur')

    const disable = await apiCall('POST', '/api/auth/mfa/disable', {
      password: PASSWORD,
    }, tokenMfa)

    assert(disable.status === 200, `Désactivation OK (HTTP ${disable.status})`)
    assert(disable.data.success === true, 'MFA désactivé')

    // ========== ÉTAPE 15 : Vérifier que le MFA est bien désactivé ==========
    section('ÉTAPE 15 — Statut final MFA')

    const status4 = await apiCall('GET', '/api/auth/mfa/status', null, tokenMfa)
    assert(status4.status === 200, 'Statut récupéré')
    assert(status4.data.enabled === false, 'MFA bien désactivé à la fin')

    // ========== ÉTAPE 16 : Re-login simple → ne doit plus demander MFA ==========
    section('ÉTAPE 16 — Login simple après désactivation')

    const login3 = await apiCall('POST', '/api/auth/login', {
      email: EMAIL,
      password: PASSWORD,
      tenantId: TENANT,
    })

    assert(login3.status === 200, `Login OK (HTTP ${login3.status})`)
    assert(!login3.data.mfaRequired, 'MFA non redemandé')
    assert(!!login3.data.token, 'Token JWT direct reçu')

    // ========== RÉSULTAT ==========
    section('🎉 RÉSULTAT FINAL')
    console.log(`\n   ✅ Tests réussis : ${passed}`)
    console.log(`   ❌ Tests échoués : ${failed}`)
    console.log(`\n   🎉 TOUS LES TESTS MFA SONT PASSÉS !\n`)

    process.exit(0)

  } catch (err) {
    section('❌ ÉCHEC')
    console.error(`\n   Message : ${err.message}`)
    console.log(`\n   ✅ Tests réussis avant échec : ${passed}`)
    console.log(`   ❌ Test échoué : ${failed}\n`)

    if (err.message.includes('assertion') || err.message.includes('Assertion')) {
      console.error('   → Vérifie les logs du backend pour identifier la cause.\n')
    }

    process.exit(1)
  }
}

runTests()