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
  console.log('Démarrage des tests API resources.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE RESOURCE
    console.log('Création d une ressource...')
    const uniqueCode = 'TEST-' + Date.now()
    const resource = await apiCall('POST', '/api/resources', {
      type: 'Table de travail',
      name: 'Table Test API',
      unique_code: uniqueCode,
      status: 'Disponible'
    }, token)
    const rid = resource.id
    console.log(`OK - Ressource #${rid} créée (${uniqueCode})\n`)

    // 2. BOOK RESOURCE
    console.log('Réservation de la ressource...')
    const today = new Date().toISOString().split('T')[0]
    const booking = await apiCall('POST', `/api/resources/${rid}/book`, {
      booking_date: today,
      slot: 'Matin'
    }, token)
    const bid = booking.id
    console.log(`OK - Réservation #${bid} créée\n`)

    // 3. RELEASE BOOKING
    console.log('Libération de la réservation...')
    await apiCall('POST', `/api/resources/bookings/${bid}/release`, null, token)
    console.log(`OK - Réservation #${bid} libérée\n`)

    // (Nettoyage optionnel : on supprime la ressource)
    console.log('Nettoyage : suppression de la ressource...')
    await apiCall('DELETE', `/api/resources/${rid}`, null, token)
    console.log(`OK - Ressource #${rid} supprimée\n`)

    console.log('TOUS LES TESTS RESOURCES SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()