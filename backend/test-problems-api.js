import 'dotenv/config'

const BASE_URL = 'http://localhost:3001'
const TENANT = 'entreprise-alpha'
const EMAIL = 'admin@entreprise-alpha.local' // Ton email admin
const PASSWORD = 'admin123'                 // Ton mot de passe

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
  
  if (!res.ok) {
    throw new Error(`[${method} ${endpoint}] Erreur ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

async function runTests() {
  console.log('Démarrage des tests API problems.js...\n')
  let token = ''

  try {
    // 0. LOGIN
    console.log('Connexion...')
    const auth = await apiCall('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenantId: TENANT })
    token = auth.token
    console.log('OK - Connecté\n')

    // 1. TICKET DE TEST (pour le lier au problème)
    console.log('Création du ticket de test...')
    const ticket = await apiCall('POST', '/api/tickets', {
      title: 'Ticket pour test Problem API',
      category: 'Informatique',
      priority: 'Basse',
      description: 'Test auto'
    }, token)
    console.log(`OK - Ticket #${ticket.id} créé\n`)

    // 2. CREATE PROBLEM
    console.log('Création du problème...')
    const problem = await apiCall('POST', '/api/problems', {
      title: 'Problème API Test complet',
      symptoms: 'Symptômes test',
      priority: 'Moyenne',
      category: 'Test'
    }, token)
    const pid = problem.id
    console.log(`OK - Problème #${pid} créé\n`)

    // 3. PATCH PROBLEM (ajout workaround)
    console.log('Modification du problème...')
    await apiCall('PATCH', `/api/problems/${pid}`, {
      root_cause: 'Cause test API',
      workaround: 'Workaround test API'
    }, token)
    console.log(`OK - Problème #${pid} modifié\n`)

    // 4. LINK TICKET
    console.log('Liaison du ticket...')
    await apiCall('POST', `/api/problems/${pid}/link-ticket`, { ticket_id: ticket.id }, token)
    console.log(`OK - Ticket #${ticket.id} lié au problème #${pid}\n`)

    // 5. UNLINK TICKET
    console.log('Déliement du ticket...')
    await apiCall('DELETE', `/api/problems/${pid}/unlink-ticket/${ticket.id}`, null, token)
    console.log(`OK - Ticket délié\n`)

    // 6. CREATE KB (KEDB)
    console.log('Création du KEDB...')
    const kb = await apiCall('POST', `/api/problems/${pid}/create-kb`, null, token)
    console.log(`OK - Article KEDB #${kb.kb_article_id} créé\n`)

    // 7. DELETE PROBLEM
    console.log('Suppression du problème...')
    await apiCall('DELETE', `/api/problems/${pid}`, null, token)
    console.log(`OK - Problème #${pid} supprimé\n`)

    console.log('TOUS LES TESTS SONT PASSES AVEC SUCCES !')
    console.log('Va vérifier les logs sur Turso.')

  } catch (err) {
    console.error('\nECHEC DU TEST :')
    console.error(err.message)
  }
}

runTests()