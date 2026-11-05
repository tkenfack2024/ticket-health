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
  console.log('Démarrage des tests API sla.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. Récupérer les politiques existantes pour en modifier une
    console.log('Récupération des politiques SLA...')
    const policies = await apiCall('GET', '/api/sla/policies', null, token)
    if (policies.length === 0) throw new Error('Aucune politique SLA trouvée pour le test')
    
    const targetPolicy = policies[0]
    console.log(`OK - Politique "${targetPolicy.priority}" (ID: ${targetPolicy.id}) trouvée\n`)

    // 2. Modifier la politique
    console.log('Modification de la politique SLA...')
    const updated = await apiCall('PUT', `/api/sla/policies/${targetPolicy.id}`, {
      response_minutes: targetPolicy.response_minutes + 1, // On change juste un peu
      resolution_minutes: targetPolicy.resolution_minutes + 1,
      escalation_percent: targetPolicy.escalation_percent
    }, token)
    console.log(`OK - Politique modifiée (Nouveau temps de réponse: ${updated.response_minutes}min)\n`)

    console.log('TOUS LES TESTS SLA SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()