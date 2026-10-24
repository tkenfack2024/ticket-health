import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-alpha';
const email = process.argv[3] || 'admin@entreprise-alpha.local';
const newPassword = process.argv[4] || 'admin123';

const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

async function reset() {
  const hash = bcrypt.hashSync(newPassword, 10);
  console.log('Nouveau hash généré :', hash);
  
  const result = await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE email = ?',
    args: [hash, email]
  });
  
  if (result.rowsAffected === 0) {
    console.error(`❌ Utilisateur ${email} non trouvé dans ${tenantId}`);
  } else {
    console.log(`✅ Mot de passe réinitialisé pour ${email} dans ${tenantId}`);
    console.log(`   Mot de passe : ${newPassword}`);
  }
  
  // Vérifier
  const check = await db.execute({ sql: 'SELECT email, password_hash FROM users WHERE email = ?', args: [email] });
  console.log('Vérification :', check.rows[0]);
  
  process.exit(0);
}
reset();