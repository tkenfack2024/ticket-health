import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-test';
const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

const defaultServices = [
  {
    name: 'Demander un PC portable',
    description: 'Commander un nouvel ordinateur portable pour votre travail',
    category: 'Hardware',
    icon: 'Monitor',
    color: 'blue',
    sla_hours: 120,
    requires_approval: 1,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'marque', label: 'Marque souhaitée', type: 'select', options: ['Dell', 'HP', 'Lenovo', 'Apple', 'Peu importe'], required: true },
      { name: 'usage', label: 'Usage principal', type: 'select', options: ['Bureautique', 'Développement', 'Design', 'Médical', 'Autre'], required: true },
      { name: 'justification', label: 'Justification', type: 'textarea', required: true, placeholder: 'Pourquoi avez-vous besoin de ce PC ?' },
    ]),
  },
  {
    name: 'Demander un accès VPN',
    description: 'Obtenir un accès au réseau privé virtuel de l\'établissement',
    category: 'Access',
    icon: 'Shield',
    color: 'purple',
    sla_hours: 2,
    requires_approval: 1,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'reason', label: 'Motif de la demande', type: 'textarea', required: true },
      { name: 'duration', label: 'Durée souhaitée', type: 'select', options: ['1 jour', '1 semaine', '1 mois', 'Permanent'], required: true },
    ]),
  },
  {
    name: 'Demander une adresse email',
    description: 'Créer une nouvelle adresse email professionnelle',
    category: 'Software',
    icon: 'Mail',
    color: 'green',
    sla_hours: 24,
    requires_approval: 0,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'desired_email', label: 'Adresse souhaitée', type: 'text', required: true, placeholder: 'prenom.nom@healthticket.com' },
      { name: 'department', label: 'Service', type: 'text', required: true },
    ]),
  },
  {
    name: 'Signaler une panne d\'imprimante',
    description: 'Signaler un problème sur une imprimante',
    category: 'Incident',
    icon: 'Printer',
    color: 'red',
    sla_hours: 8,
    requires_approval: 0,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'location', label: 'Localisation de l\'imprimante', type: 'text', required: true, placeholder: 'Bureau 204, Étage 2...' },
      { name: 'problem', label: 'Description du problème', type: 'textarea', required: true },
    ]),
  },
  {
    name: 'Demander un logiciel',
    description: 'Installer un nouveau logiciel sur votre poste',
    category: 'Software',
    icon: 'Package',
    color: 'amber',
    sla_hours: 48,
    requires_approval: 1,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'software_name', label: 'Nom du logiciel', type: 'text', required: true },
      { name: 'version', label: 'Version souhaitée', type: 'text', required: false },
      { name: 'justification', label: 'Justification', type: 'textarea', required: true },
    ]),
  },
  {
    name: 'Demander une formation',
    description: 'Demander une formation IT',
    category: 'Formation',
    icon: 'BookOpen',
    color: 'slate',
    sla_hours: 240,
    requires_approval: 1,
    approver_role: 'admin',
    form_fields: JSON.stringify([
      { name: 'topic', label: 'Sujet de la formation', type: 'text', required: true },
      { name: 'level', label: 'Niveau', type: 'select', options: ['Débutant', 'Intermédiaire', 'Avancé'], required: true },
    ]),
  },
];

async function seed() {
  let count = 0;
  for (const s of defaultServices) {
    try {
      const existing = await db.execute({ sql: 'SELECT id FROM service_catalog WHERE name = ?', args: [s.name] });
      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO service_catalog (name, description, category, icon, color, form_fields, sla_hours, requires_approval, approver_role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [s.name, s.description, s.category, s.icon, s.color, s.form_fields, s.sla_hours, s.requires_approval, s.approver_role]
        });
        count++;
      }
    } catch (err) {
      console.error(`Erreur service ${s.name}:`, err.message);
    }
  }
  console.log(`✅ ${count} services insérés dans ${tenant.name}`);
  process.exit(0);
}
seed();