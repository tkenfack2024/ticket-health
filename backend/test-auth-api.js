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
  if (!res.ok) throw new Error(`[${method} ${endpoint}] Erreur ${res.status}: ${JSON.stringify(data)}`)
  return data
}

async function runTests() {
  console.log('Démarrage des tests API auth.js...\n')

  try {
    // 1. REGISTER (génère un log 'register')
    console.log('Test de création de compte (register)...')
    const randomEmail = `test-${Date.now()}@entreprise-alpha.local`
    await apiCall('POST', '/api/auth/register', { 
      name: 'Test User', 
      email: randomEmail, 
      password: 'password123', 
      tenantId: TENANT 
    })
    console.log(`OK - Compte ${randomEmail} créé\n`)

    // 2. LOGIN (génère un log 'login')
    console.log('Test de connexion (login)...')
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    const token = auth.token
    console.log('OK - Connexion réussie\n')

    // 3. REQUEST OTP (génère un log 'otp-request')
    console.log('Test de demande OTP (sur le compte créé)...')
    await apiCall('POST', '/api/auth/request-otp', { email: randomEmail, tenantId: TENANT })
    console.log('OK - Code OTP demandé\n')

    console.log('TOUS LES TESTS AUTH SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()