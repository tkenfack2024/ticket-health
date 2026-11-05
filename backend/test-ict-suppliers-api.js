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
  console.log('Démarrage des tests API ict-suppliers.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE ICT SUPPLIER
    console.log('Création d un tiers ICT...')
    const name = 'Tiers ICT Test ' + Date.now()
    const supplier = await apiCall('POST', '/api/ict-suppliers', {
      name: name,
      service_type: 'Hébergement',
      criticality: 'Important',
      country: 'France',
      dpa_signed: true,
      status: 'Actif'
    }, token)
    const sid = supplier.id
    console.log(`OK - Tiers ICT #${sid} créé\n`)

    // 2. UPDATE ICT SUPPLIER
    console.log('Modification du tiers ICT...')
    await apiCall('PATCH', `/api/ict-suppliers/${sid}`, {
      name: name,
      service_type: 'Hébergement',
      criticality: 'Important',
      country: 'France',
      dpa_signed: true,
      status: 'Inactif', // Test de modif
      notes: 'Note test'
    }, token)
    console.log(`OK - Tiers ICT #${sid} modifié\n`)

    // 3. DELETE ICT SUPPLIER
    console.log('Suppression du tiers ICT...')
    await apiCall('DELETE', `/api/ict-suppliers/${sid}`, null, token)
    console.log(`OK - Tiers ICT #${sid} supprimé\n`)

    console.log('TOUS LES TESTS ICT-SUPPLIERS SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()