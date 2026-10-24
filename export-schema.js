import Database from 'better-sqlite3'
import fs from 'fs'

const db = new Database('tickets.db')
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()

let sql = ''
for (const t of tables) {
  if (t.sql) {
    sql += t.sql + ';\n\n'
  }
}

fs.writeFileSync('schema.sql', sql, 'utf-8')
console.log(`✅ ${tables.length} tables exportées dans schema.sql`)
process.exit(0)