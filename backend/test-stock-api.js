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
  console.log('Démarrage des tests API stock.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE STOCK ITEM
    console.log('Création d un article de stock...')
    const itemName = 'Article Test API ' + Date.now()
    const item = await apiCall('POST', '/api/stock', {
      name: itemName,
      category: 'Test',
      unit: 'pièce',
      min_threshold: 2,
      initial_quantity: 10
    }, token)
    const iid = item.id
    console.log(`OK - Article #${iid} créé\n`)

    // 2. MOVEMENT
    console.log('Mouvement de stock (SORTIE)...')
    const movement = await apiCall('POST', `/api/stock/${iid}/movement`, {
      type: 'SORTIE',
      quantity: 1,
      reason: 'Test API'
    }, token)
    console.log(`OK - Mouvement effectué (Nouveau stock: ${movement.new_quantity})\n`)

    console.log('TOUS LES TESTS STOCK SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()