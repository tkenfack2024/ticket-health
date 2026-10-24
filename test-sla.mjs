import Database from 'better-sqlite3'
const db = new Database('tickets.db')

const id = parseInt(process.argv[2])
if (!id) {
  console.log('Usage: node test-sla.mjs <ID_TICKET>')
  process.exit(1)
}

const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(id)
if (!ticket) {
  console.log('❌ Ticket introuvable')
  process.exit(1)
}

db.prepare(`
  UPDATE tickets
  SET sla_resolution_deadline = datetime('now', '+10 minutes', 'localtime'),
      created_at = datetime('now', '-110 minutes', 'localtime'),
      sla_escalated = 0
  WHERE id = ?
`).run(id)

console.log(`✅ Ticket #${id} "${ticket.title}" modifié pour simuler un SLA à ~91%`)
console.log('⏱️  Attends 30-60 secondes pour voir le cron escalader...')