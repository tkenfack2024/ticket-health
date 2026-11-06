import 'dotenv/config'

const BASE_URL = 'http://localhost:3001'
const TENANT = 'entreprise-alpha'
const EMAIL = 'admin@entreprise-alpha.local'
const PASSWORD = 'admin123'

async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

async function runTests() {
  console.log('🔐 Démarrage des tests MFA...\n')

  try {
    // 1. LOGIN NORMAL (sans MFA pour récupérer le token)
    console.log('1️⃣ Connexion sans MFA...')
    const login1 = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    
    if (login1.data.mfaRequired) {
      console.log('⚠️ Le MFA est déjà activé sur ce compte. Test impossible.')
      return
    }
    
    const token = login1.data.token
    console.log('✅ Connecté (token reçu)\n')

    // 2. SETUP MFA (générer secret + QR + recovery codes)
    console.log('2️⃣ Génération du secret MFA...')
    const setup = await apiCall('POST', '/api/auth/mfa/setup', null, token)
    
    if (setup.status !== 200) {
      console.log('❌ Erreur setup:', setup.data)
      return
    }
    
    console.log('✅ Secret généré')
    console.log(`   Secret : ${setup.data.secret}`)
    console.log(`   Recovery codes : ${setup.data.recoveryCodes.join(', ')}\n`)

    // 3. VÉRIFIER LE CODE (générer un code TOTP à partir du secret)
    console.log('3️⃣ Génération du code TOTP actuel...')
    const { generate } = await import('otplib')
    const totpCode = await generate({ secret: setup.data.secret })
    console.log(`   Code TOTP : ${totpCode}\n`)

    // 4. ACTIVER LE MFA
    console.log('4️⃣ Activation du MFA...')
    const verify = await apiCall('POST', '/api/auth/mfa/verify', { code: totpCode }, token)
    
    if (verify.status !== 200) {
      console.log('❌ Erreur activation:', verify.data)
      return
    }
    console.log('✅ MFA activé\n')

    // 5. SE RECONNECTER (doit maintenant demander le MFA)
    console.log('5️⃣ Reconnexion (doit demander MFA)...')
    const login2 = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    
    if (!login2.data.mfaRequired) {
      console.log('❌ Le MFA n\'a pas été déclenché !')
      return
    }
    console.log('✅ MFA bien demandé au login\n')

    // 6. VÉRIFIER LE CODE MFA
    console.log('6️⃣ Vérification du code MFA au login...')
    const totpCode2 = await generate({ secret: setup.data.secret })
    const loginMfa = await apiCall('POST', '/api/auth/login/mfa', {
      userId: login2.data.userId,
      tenantId: login2.data.tenantId,
      code: totpCode2
    })
    
    if (loginMfa.status !== 200) {
      console.log('❌ Erreur login MFA:', loginMfa.data)
      return
    }
    console.log('✅ Connexion MFA réussie !')
    console.log(`   User : ${loginMfa.data.user.name} (${loginMfa.data.user.email})\n`)

    // 7. DÉSACTIVER LE MFA (nettoyage)
    console.log('7️⃣ Désactivation du MFA (nettoyage)...')
    const disable = await apiCall('POST', '/api/auth/mfa/disable', { password: PASSWORD }, loginMfa.data.token)
    
    if (disable.status !== 200) {
      console.log('❌ Erreur désactivation:', disable.data)
      return
    }
    console.log('✅ MFA désactivé\n')

    console.log('🎉 TOUS LES TESTS MFA SONT PASSÉS !')

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST :')
    console.error(err.message)
    console.error(err.stack)
  }
}

runTests()