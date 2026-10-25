import { createClient } from '@libsql/client';
import { TENANTS } from './tenants.js';

const tenantId = process.argv[2] || 'entreprise-alpha';
const tenant = TENANTS[tenantId];
if (!tenant) { console.error('Entreprise inconnue'); process.exit(1); }

const db = createClient({ url: tenant.url, authToken: tenant.token });

const SLA = {
  Urgente: { response: 15, resolution: 120 },
  Haute: { response: 30, resolution: 480 },
  Moyenne: { response: 120, resolution: 1440 },
  Basse: { response: 480, resolution: 4320 },
};

async function fix() {
  const ticketsResult = await db.execute(
    "SELECT id, priority, created_at FROM tickets WHERE sla_resolution_deadline IS NULL"
  );
  const tickets = ticketsResult.rows;
  
  console.log(`🔧 ${tickets.length} ticket(s) à mettre à jour`);
  
  let count = 0;
  for (const ticket of tickets) {
    const sla = SLA[ticket.priority] || SLA['Moyenne'];
    const created = new Date(ticket.created_at);
    const responseDeadline = new Date(created.getTime() + sla.response * 60 * 1000);
    const resolutionDeadline = new Date(created.getTime() + sla.resolution * 60 * 1000);
    
    const format = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    
    await db.execute({
      sql: 'UPDATE tickets SET sla_response_deadline = ?, sla_resolution_deadline = ? WHERE id = ?',
      args: [format(responseDeadline), format(resolutionDeadline), ticket.id]
    });
    count++;
  }
  
  console.log(`✅ ${count} ticket(s) mis à jour dans ${tenant.name}`);
  process.exit(0);
}
fix();