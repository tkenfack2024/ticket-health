import 'dotenv/config'
import { createClient } from '@libsql/client'
import { TENANTS } from './tenants.js'

const tenantId = process.argv[2] || 'entreprise-alpha'
const tenant = TENANTS[tenantId]
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1) }

const db = createClient({ url: tenant.url, authToken: tenant.token })

const defaultSuppliers = [
  {
    name: 'Turso (LibSQL)',
    service_type: 'Base de données cloud',
    service_description: 'Hébergement des bases de données SQLite multi-tenant (Local, Entreprise-Alpha, Entreprise-Beta, Entreprise-Test)',
    criticality: 'Critique',
    country: 'États-Unis (AWS eu-west-1)',
    dpa_signed: 1,
    dpa_date: '2026-01-01',
    contract_start: '2026-01-01',
    contract_end: '2027-01-01',
    contact_name: 'Support Turso',
    contact_email: 'support@turso.tech',
    contact_phone: null,
    data_location: 'Cloud (AWS eu-west-1)',
    exit_plan: 'Export SQLite via CLI turso db dump, restauration locale possible',
    notes: 'Données patients chiffrées au repos (AES-256-GCM) côté application',
    status: 'Actif',
  },
  {
    name: 'Render',
    service_type: 'Hébergement / PaaS',
    service_description: 'Hébergement du backend Node.js et du frontend React (production)',
    criticality: 'Critique',
    country: 'États-Unis',
    dpa_signed: 1,
    dpa_date: '2026-01-01',
    contract_start: '2026-01-01',
    contract_end: '2027-01-01',
    contact_name: 'Support Render',
    contact_email: 'support@render.com',
    contact_phone: null,
    data_location: 'Cloud (us-east-1)',
    exit_plan: 'Migration vers un autre PaaS via git push + variables env',
    notes: 'Plan gratuit = cold start après 15 min d\'inactivité. Production = plan payant recommandé.',
    status: 'Actif',
  },
  {
    name: 'Gmail (SMTP)',
    service_type: 'Email transactionnel',
    service_description: 'Envoi des emails OTP, notifications tickets, alertes SLA',
    criticality: 'Important',
    country: 'États-Unis',
    dpa_signed: 0,
    dpa_date: null,
    contract_start: '2026-01-01',
    contract_end: null,
    contact_name: 'Google Workspace',
    contact_email: 'admin@google.com',
    contact_phone: null,
    data_location: 'Cloud (Google)',
    exit_plan: 'Migration vers un autre SMTP (SendGrid, Mailgun, Postmark)',
    notes: 'Mot de passe d\'application Gmail dans .env (à sécuriser davantage)',
    status: 'Actif',
  },
]

async function seed() {
  let inserted = 0
  let skipped = 0

  for (const s of defaultSuppliers) {
    try {
      const existing = await db.execute({ sql: 'SELECT id FROM ict_suppliers WHERE name = ?', args: [s.name] })
      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO ict_suppliers (
                  name, service_type, service_description, criticality, country,
                  dpa_signed, dpa_date, contract_start, contract_end,
                  contact_name, contact_email, contact_phone,
                  data_location, exit_plan, notes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            s.name, s.service_type, s.service_description, s.criticality, s.country,
            s.dpa_signed, s.dpa_date, s.contract_start, s.contract_end,
            s.contact_name, s.contact_email, s.contact_phone,
            s.data_location, s.exit_plan, s.notes, s.status,
          ],
        })
        inserted++
        console.log(`✅ Tiers ICT ajouté : ${s.name}`)
      } else {
        skipped++
        console.log(`ℹ️  Déjà existant : ${s.name}`)
      }
    } catch (err) {
      console.error(`❌ Erreur pour ${s.name}:`, err.message)
    }
  }

  console.log(`\n🎉 Terminé : ${inserted} ajouté(s), ${skipped} ignoré(s) dans ${tenant.name}`)
  process.exit(0)
}

seed()