import Database from 'better-sqlite3'
const db = new Database('tickets.db')

const articles = db.prepare('SELECT id, title, summary FROM kb_articles').all()
console.log(JSON.stringify(articles, null, 2))
