// backend/seed-roles-turso.js
import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2];
if (!tenantId) {
  console.error('❌ Usage : node seed-roles-turso.js <nom-du-tenant>');
  process.exit(1);
}

const tenant = TENANTS[tenantId];
if (!tenant) {
  console.error(`❌ L'entreprise "${tenantId}" n'existe pas.`);
  process.exit(1);
}

const db = createClient({ url: tenant.url, authToken: tenant.token });

const ROLES = [
  { name: 'Admin', description: 'Accès complet à toutes les fonctionnalités' },
  { name: 'Médecin', description: 'Consultations, diagnostics et prescriptions' },
  { name: 'Infirmier', description: 'Soins, constantes et administration des traitements' },
  { name: 'Pharmacien', description: 'Délivrance des ordonnances et gestion du stock' },
  { name: 'Secrétaire', description: 'Accueil des patients et gestion de la salle d\'attente' },
  { name: 'Laborantin', description: 'Gestion des demandes d\'examens et des résultats' },
  { name: 'Technicien', description: 'Support IT, gestion des tickets et des assets' },
  { name: 'RSSI', description: 'Sécurité, audit des logs et conformité RGPD' },
  { name: 'Gestionnaire de Stock', description: 'Gestion de l\'inventaire médical' },
  { name: 'Responsable Ressources', description: 'Gestion des bâtiments, lits et fournisseurs' },
  { name: 'Utilisateur', description: 'Accès basique au portail self-service' }
];

async function run() {
  try {
    console.log(`⏳ Injection des rôles dans ${tenant.name}...`);
    
    for (const r of ROLES) {
      // On vérifie s'il existe déjà
      const check = await db.execute({ sql: 'SELECT id FROM roles WHERE name = ?', args: [r.name] });
      if (check.rows.length === 0) {
        await db.execute({
          sql: 'INSERT INTO roles (name, description) VALUES (?, ?)',
          args: [r.name, r.description]
        });
        console.log(`   ✅ Rôle "${r.name}" ajouté.`);
      } else {
        // Optionnel : on met à jour la description si le rôle existe déjà
        await db.execute({
          sql: 'UPDATE roles SET description = ? WHERE name = ?',
          args: [r.description, r.name]
        });
        console.log(`   ℹ️ Rôle "${r.name}" mis à jour.`);
      }
    }
    console.log('✅ Terminé !');
  } catch (err) {
    console.error('❌ Erreur :', err.message);
  } finally {
    process.exit(0);
  }
}
run();