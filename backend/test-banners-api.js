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
  console.log('Démarrage des tests API banners.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE BANNER
    console.log('Création d une bannière...')
    const bannerTitle = 'Bannière Test API ' + Date.now()
    const banner = await apiCall('POST', '/api/banners', {
      title: bannerTitle,
      message: 'Message de test',
      variant: 'info',
      duration_seconds: 10
    }, token)
    const bid = banner.id
    console.log(`OK - Bannière #${bid} créée\n`)

    // 2. UPDATE BANNER
    console.log('Modification de la bannière...')
    await apiCall('PATCH', `/api/banners/${bid}`, {
      message: 'Message modifié'
    }, token)
    console.log(`OK - Bannière #${bid} modifiée\n`)

    // 3. TOGGLE BANNER (désactivation)
    console.log('Désactivation de la bannière...')
    await apiCall('POST', `/api/banners/${bid}/toggle`, null, token)
    console.log(`OK - Bannière #${bid} désactivée\n`)

    // 4. DELETE BANNER
    console.log('Suppression de la bannière...')
    await apiCall('DELETE', `/api/banners/${bid}`, null, token)
    console.log(`OK - Bannière #${bid} supprimée\n`)

    console.log('TOUS LES TESTS BANNERS SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()