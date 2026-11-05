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
  console.log('Démarrage des tests API risks.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE RISK
    console.log('Création d un risque...')
    const riskTitle = 'Risque Test API ' + Date.now()
    const risk = await apiCall('POST', '/api/risks', {
      title: riskTitle,
      description: 'Description test',
      category: 'Test',
      probability: 3,
      impact: 4,
      mitigation_plan: 'Plan de mitigation',
      owner: 'Admin',
      status: 'Ouvert'
    }, token)
    const rid = risk.id
    console.log(`OK - Risque #${rid} créé\n`)

    // 2. UPDATE RISK
    console.log('Modification du risque...')
        await apiCall('PATCH', `/api/risks/${rid}`, {
      title: riskTitle,
      description: 'Description test',
      category: 'Test',
      probability: 3,
      impact: 4,
      mitigation_plan: 'Plan de mitigation mis à jour',
      owner: 'Admin',
      status: 'Ouvert'
    }, token)
    console.log(`OK - Risque #${rid} modifié\n`)

    // 3. DELETE RISK
    console.log('Suppression du risque...')
    await apiCall('DELETE', `/api/risks/${rid}`, null, token)
    console.log(`OK - Risque #${rid} supprimé\n`)

    console.log('TOUS LES TESTS RISKS SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()