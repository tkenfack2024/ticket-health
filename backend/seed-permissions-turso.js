// backend/seed-permissions-turso.js
import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';
import { PERMISSIONS_LIST } from './permissions-list.js';

const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Usage : node seed-permissions-turso.js <nom-du-tenant>');
  console.error('   Exemple : node seed-permissions-turso.js entreprise-alpha');
  console.error('   Tenants disponibles : ' + Object.keys(TENANTS).join(', '));
  process.exit(1);
}

const tenant = TENANTS[tenantId];
if (!tenant) {
  console.error(`❌ L'entreprise "${tenantId}" n'existe pas dans tenants.js.`);
  process.exit(1);
}

console.log(`⏳ Connexion à Turso pour ${tenant.name} (${tenantId})...`);
const db = createClient({ url: tenant.url, authToken: tenant.token });

async function run() {
  try {
    console.log('🧹 Nettoyage des anciennes permissions...');
    // On supprime tout pour repartir à zéro
    await db.execute('DELETE FROM permissions');
    
    console.log(`📦 Injection de ${PERMISSIONS_LIST.length} permissions...`);
    
    let count = 0;
    for (const p of PERMISSIONS_LIST) {
      await db.execute({
        sql: 'INSERT INTO permissions (code, label, module, description) VALUES (?, ?, ?, ?)',
        args: [p.code, p.label, p.module, null]
      });
      count++;
      if (count % 20 === 0) process.stdout.write('.'); // Petit point de progression
    }

    console.log(`\n✅ ${count} permissions injectées avec succès dans ${tenant.name} !`);
    
    // Vérification
    const check = await db.execute('SELECT COUNT(*) as c FROM permissions');
    console.log(`📊 Total dans la base Turso : ${check.rows[0].c} permissions.`);

  } catch (err) {
    console.error('\n❌ Erreur lors de l\'injection :', err.message);
    if (err.message.includes('no such table')) {
      console.error('   (Astuce : as-tu bien lancé "node migrate.js ' + tenantId + '" avant ?)');
    }
  } finally {
    process.exit(0);
  }
}

run();