import Database from 'better-sqlite3'
const db = new Database('tickets.db')

const command = process.argv[2]

// Liste des commandes disponibles
const commands = {
  'tickets': () => {
    console.log('\n📋 5 derniers tickets :')
    console.log(db.prepare('SELECT id, title, priority, status, sla_resolution_deadline, sla_escalated FROM tickets ORDER BY id DESC LIMIT 5').all())
  },

  'escalations': () => {
    console.log('\n🚨 10 dernières escalations :')
    console.log(db.prepare("SELECT * FROM logs WHERE action = 'escalate' ORDER BY id DESC LIMIT 10").all())
  },

  'logs': () => {
    console.log('\n📜 10 derniers logs :')
    console.log(db.prepare('SELECT id, user_name, action, entity, entity_id, details, created_at FROM logs ORDER BY id DESC LIMIT 10').all())
  },

  'sla-policies': () => {
    console.log('\n⏱️  Politiques SLA :')
    console.log(db.prepare('SELECT * FROM sla_policies').all())
  },

  'users': () => {
    console.log('\n👥 Utilisateurs :')
    console.log(db.prepare('SELECT id, name, email, role, active FROM users ORDER BY id DESC').all())
  },

  'stats-sla': () => {
    console.log('\n📊 Stats SLA rapides :')
    const all = db.prepare('SELECT * FROM tickets WHERE archived = 0').all()
    const now = Date.now()
    let ok = 0, threatened = 0, exceeded = 0, paused = 0, noSla = 0
    for (const t of all) {
      if (!t.sla_resolution_deadline) { noSla++; continue }
      if (t.sla_paused_at) { paused++; continue }
      if (t.status === 'Résolu' && t.resolved_at) {
        const ok_res = new Date(t.resolved_at) <= new Date(t.sla_resolution_deadline)
        if (ok_res) ok++; else exceeded++
        continue
      }
      const deadline = new Date(t.sla_resolution_deadline).getTime()
      const created = new Date(t.created_at).getTime()
      const total = deadline - created
      const elapsed = now - created
      if (now > deadline) exceeded++
      else if ((elapsed / total) * 100 >= 80) threatened++
      else ok++
    }
    console.log({ total: all.length, ok, threatened, exceeded, paused, noSla })
  },

  'help': () => {
    console.log('\n📚 Commandes disponibles :')
    console.log('  node check-db.mjs tickets        → 5 derniers tickets')
    console.log('  node check-db.mjs escalations    → 10 dernières escalations')
    console.log('  node check-db.mjs logs           → 10 derniers logs')
    console.log('  node check-db.mjs sla-policies   → Politiques SLA')
    console.log('  node check-db.mjs users          → Liste des utilisateurs')
    console.log('  node check-db.mjs stats-sla      → Statistiques SLA rapides')
  },
}

if (!command || !commands[command]) {
  commands.help()
} else {
  commands[command]()
}