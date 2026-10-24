import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { TENANTS } from './tenants.js';

// Récupère le tenantId depuis les arguments (par défaut : entreprise-test)
const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];

if (!tenant) {
  console.error(`❌ Entreprise inconnue : ${tenantId}`);
  process.exit(1);
}

const db = createClient({ url: tenant.url, authToken: tenant.token });

async function seed() {
  try {
    console.log(`🌱 Seed de la base : ${tenant.name} (${tenantId})`);

    // 1. Créer le rôle "Admin" (s'il n'existe pas)
    const existingRole = await db.execute({
      sql: 'SELECT id FROM roles WHERE name = ?',
      args: ['Admin']
    });

    if (existingRole.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO roles (name, description) VALUES (?, ?)',
        args: ['Admin', 'Accès complet à toutes les fonctionnalités']
      });
      console.log('✅ Rôle "Admin" créé');
    } else {
      console.log('ℹ️  Rôle "Admin" existe déjà');
    }

    // 2. Créer un utilisateur admin (email unique par entreprise)
    const adminEmail = `admin@${tenantId}.local`;
    const existingAdmin = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [adminEmail]
    });

    if (existingAdmin.rows.length > 0) {
      console.log(`ℹ️  L'admin "${adminEmail}" existe déjà. Mise à jour du rôle...`);
      await db.execute({
        sql: 'UPDATE users SET role = ? WHERE email = ?',
        args: ['admin', adminEmail]
      });
    } else {
      const hash = bcrypt.hashSync('admin123', 10);
      await db.execute({
        sql: `INSERT INTO users (name, email, phone, password_hash, role, active) 
              VALUES (?, ?, ?, ?, 'admin', 1)`,
        args: [`Admin ${tenant.name}`, adminEmail, null, hash]
      });
      console.log(`✅ Utilisateur "${adminEmail}" créé (mot de passe : admin123)`);
    }

    // 3. Vérification
    const user = await db.execute({
      sql: 'SELECT id, name, email, role FROM users WHERE email = ?',
      args: [adminEmail]
    });
    console.log('\n📋 Résumé de l\'admin :');
    console.log(user.rows[0]);

    console.log('\n✅ Seed terminé ! Vous pouvez maintenant vous connecter avec :');
    console.log(`   Entreprise : ${tenant.name} (${tenantId})`);
    console.log(`   Email      : ${adminEmail}`);
    console.log('   Mot de passe : admin123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err);
    process.exit(1);
  }
}

seed();