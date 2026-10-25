import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

const categories = [
  ['Informatique', 'Articles liés à l\'informatique', 'Monitor', 'blue'],
  ['Équipement médical', 'Articles sur le matériel médical', 'HeartPulse', 'red'],
  ['Administratif', 'Articles administratifs', 'FileText', 'slate'],
  ['Infrastructure', 'Réseau, bâtiment, électricité', 'Building2', 'amber'],
  ['Erreurs connues', 'KEDB - Erreurs connues avec workarounds', 'AlertTriangle', 'orange'],
  ['Autre', 'Articles divers', 'BookOpen', 'slate'],
];

async function seed() {
  for (const c of categories) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO kb_categories (name, description, icon, color) VALUES (?, ?, ?, ?)`,
        args: c
      });
    } catch (err) {
      console.error(`Erreur catégorie ${c[0]}:`, err.message);
    }
  }
  console.log(`✅ ${categories.length} catégories insérées dans ${tenant.name}`);
  process.exit(0);
}
seed();