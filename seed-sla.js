import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

async function seed() {
  const policies = [
    ['Basse', 480, 2880, 80],
    ['Moyenne', 240, 1440, 80],
    ['Haute', 60, 480, 80],
    ['Urgente', 30, 240, 80],
  ];

  for (const p of policies) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO sla_policies (priority, response_minutes, resolution_minutes, escalation_percent, active) VALUES (?, ?, ?, ?, 1)`,
        args: p
      });
      console.log(`✅ SLA ${p[0]} créé`);
    } catch (err) {
      console.error(`❌ Erreur SLA ${p[0]}:`, err.message);
    }
  }
  process.exit(0);
}
seed();