import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

const permissions = [
  ['kb.read', 'Lire la base de connaissances', 'kb', 'Accès à la base de connaissances'],
  ['kb.write', 'Créer/modifier des articles', 'kb', 'Peut écrire et modifier des articles'],
  ['kb.publish', 'Publier des articles', 'kb', 'Peut publier directement'],
  ['assets.write', 'Modifier les assets', 'assets', 'Peut créer/modifier les équipements'],
  ['users.manage', 'Gérer les utilisateurs', 'users', 'Peut gérer les comptes utilisateurs'],
  ['logs.view', 'Voir les logs', 'logs', 'Peut consulter le journal d\'activité'],
  ['tickets.all', 'Voir tous les tickets', 'tickets', 'Peut voir tous les tickets'],
  ['medical.read', 'Voir les données patients', 'medical', 'Peut voir les informations médicales'],
  ['risk.view', 'Voir les risques', 'risk', 'Accès au registre des risques'],
  ['risk.create', 'Créer des risques', 'risk', 'Peut créer des risques'],
  ['risk.edit', 'Modifier des risques', 'risk', 'Peut modifier des risques'],
  ['risk.delete', 'Supprimer des risques', 'risk', 'Peut supprimer des risques'],
  ['changes.create', 'Créer des changements', 'changes', 'Peut créer des RFC'],
  ['stock.read', 'Lire les stocks', 'stock', 'Accès en lecture aux stocks'],
];

async function seed() {
  for (const p of permissions) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO permissions (code, label, module, description) VALUES (?, ?, ?, ?)`,
        args: p
      });
    } catch (err) {
      console.error(`Erreur permission ${p[0]}:`, err.message);
    }
  }
  console.log(`✅ ${permissions.length} permissions insérées dans ${tenant.name}`);
  process.exit(0);
}
seed();