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
  console.log('Démarrage des tests API gdpr.js...\n')
  let token = ''

  try {
    // 0. LOGIN
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE PROCESSING
    console.log('Création d un traitement RGPD...')
    const proc = await apiCall('POST', '/api/gdpr/processing', {
      name: 'Traitement Test API',
      purpose: 'Test',
      legal_basis: 'Consentement'
    }, token)
    const pid = proc.id
    console.log(`OK - Traitement #${pid} créé\n`)

    // 2. UPDATE PROCESSING
    console.log('Modification du traitement...')
    await apiCall('PATCH', `/api/gdpr/processing/${pid}`, { description: 'Description test' }, token)
    console.log(`OK - Traitement #${pid} modifié\n`)

    // 3. CREATE DPIA
    console.log('Création d une AIPD...')
    const dpia = await apiCall('POST', `/api/gdpr/processing/${pid}/dpia`, {
      context: { scope: 'Test scope' },
      risks: [{ id: 'r1', name: 'Risque 1', gravity: 3, probability: 2 }],
      security_measures: ['Chiffrement']
    }, token)
    const dpiaId = dpia.id
    console.log(`OK - AIPD #${dpiaId} créée\n`)

    // 4. UPDATE DPIA
    console.log('Modification de l AIPD...')
    await apiCall('PATCH', `/api/gdpr/dpia/${dpiaId}`, { status: 'in_progress' }, token)
    console.log(`OK - AIPD #${dpiaId} modifiée\n`)

    // 5. VALIDATE DPIA
    console.log('Validation de l AIPD...')
    await apiCall('POST', `/api/gdpr/dpia/${dpiaId}/validate`, { decision: 'validated', comments: 'Validé via test' }, token)
    console.log(`OK - AIPD #${dpiaId} validée\n`)

    // 6. DELETE PROCESSING
    console.log('Suppression du traitement...')
    await apiCall('DELETE', `/api/gdpr/processing/${pid}`, null, token)
    console.log(`OK - Traitement #${pid} supprimé\n`)

    console.log('TOUS LES TESTS GDPR SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()