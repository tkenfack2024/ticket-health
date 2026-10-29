// backend/seed-all-permissions.js
import Database from 'better-sqlite3';
import { PERMISSIONS_LIST } from './permissions-list.js';

const db = new Database('tickets.db');

console.log('⏳ Injection des permissions en cours...');

try {
  // On vide la table pour repartir sur des bases saines (attention: ça ne supprime pas les liens dans user_permissions)
  db.prepare('DELETE FROM permissions').run();
  console.log('✅ Anciennes permissions supprimées.');

  // On prépare la requête d'insertion
  const insert = db.prepare('INSERT INTO permissions (code, label, module, description) VALUES (?, ?, ?, ?)');

  // On insère chaque permission
  const transaction = db.transaction((perms) => {
    for (const p of perms) {
      insert.run(p.code, p.label, p.module, null);
    }
  });

  transaction(PERMISSIONS_LIST);
  
  console.log(`✅ ${PERMISSIONS_LIST.length} permissions injectées avec succès !`);
  
  // Vérification
  const count = db.prepare('SELECT COUNT(*) as c FROM permissions').get().c;
  console.log(`📊 Total dans la base : ${count} permissions.`);

} catch (error) {
  console.error('❌ Erreur lors de l\'injection :', error);
} finally {
  db.close();
}