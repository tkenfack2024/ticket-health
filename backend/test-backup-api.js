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
  console.log('Démarrage des tests API backup.js...\n')
  let token = ''

  try {
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. UPDATE CONFIG
    console.log('Modification de la configuration backup...')
    await apiCall('PATCH', '/api/admin/backups/config', {
      interval_hours: 12,
      enabled: true
    }, token)
    console.log(`OK - Configuration mise à jour\n`)

    // 2. CREATE BACKUP (Manuel)
    console.log('Lancement d un backup manuel (patienter quelques secondes)...')
        const backup = await apiCall('POST', '/api/admin/backups', { tenant_id: 'entreprise-alpha' }, token)
    const bid = backup.id
    console.log(`OK - Backup #${bid} créé (${backup.filename})\n`)

    // 3. DELETE BACKUP
    console.log('Suppression du backup...')
    await apiCall('DELETE', `/api/admin/backups/${bid}`, null, token)
    console.log(`OK - Backup #${bid} supprimé\n`)

    console.log('TOUS LES TESTS BACKUP SONT PASSES !')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()