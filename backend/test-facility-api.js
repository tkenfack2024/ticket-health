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
  console.log('Démarrage des tests API facility.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. CREATE SITE
    console.log('Création d un site...')
    const siteName = 'Site Test API ' + Date.now()
    const site = await apiCall('POST', '/api/facility/sites', {
      name: siteName,
      address: 'Adresse test'
    }, token)
    const sid = site.id
    console.log(`OK - Site #${sid} créé\n`)

    // 2. CREATE FLOOR
    console.log('Création d un étage...')
    const floorName = 'Étage Test API'
    const floor = await apiCall('POST', '/api/facility/floors', {
      site_id: sid,
      name: floorName
    }, token)
    const fid = floor.id
    console.log(`OK - Étage #${fid} créé\n`)

    // 3. CREATE ROOM
    console.log('Création d une salle...')
    const roomName = 'Salle Test API'
    const room = await apiCall('POST', '/api/facility/rooms', {
      floor_id: fid,
      name: roomName,
      type: 'Bureau',
      code: 'ROOM-' + Date.now()
    }, token)
    const rid = room.id
    console.log(`OK - Salle #${rid} créée\n`)

    console.log('TOUS LES TESTS FACILITY SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()