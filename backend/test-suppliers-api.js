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
  console.log('Démarrage des tests API suppliers.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE SUPPLIER
    console.log('Création d un fournisseur...')
    const supplierName = 'Fournisseur Test API ' + Date.now()
    const supplier = await apiCall('POST', '/api/suppliers', {
      name: supplierName,
      contact_name: 'Contact Test',
      email: 'test@test.com',
      phone: '123456789',
      contract_type: 'Maintenance',
      status: 'Actif'
    }, token)
    const sid = supplier.id
    console.log(`OK - Fournisseur #${sid} créé\n`)

       // 2. UPDATE SUPPLIER
    console.log('Modification du fournisseur...')
    await apiCall('PATCH', `/api/suppliers/${sid}`, {
      name: supplierName,
      contact_name: 'Contact Modifié',
      email: 'test@test.com',
      phone: '123456789',
      contract_type: 'Maintenance',
      contract_start: '2026-01-01',
      contract_end: '2027-01-01',
      status: 'Actif',
      notes: 'Note test'
    }, token)
    console.log(`OK - Fournisseur #${sid} modifié\n`)

    // 3. DELETE SUPPLIER
    console.log('Suppression du fournisseur...')
    await apiCall('DELETE', `/api/suppliers/${sid}`, null, token)
    console.log(`OK - Fournisseur #${sid} supprimé\n`)

    console.log('TOUS LES TESTS SUPPLIERS SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()