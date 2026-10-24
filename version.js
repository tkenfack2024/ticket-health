import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ==================== LECTURE VERSION ====================

export function getAppVersion() {
  try {
    const pkgPath = join(__dirname, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch (err) {
    console.error('⚠️ Impossible de lire package.json :', err.message)
    return '0.0.0'
  }
}

// ==================== LECTURE GIT ====================

export function getGitInfo() {
  try {
    // Exécuter git log pour le dernier commit
    const output = execSync(
      'git log -1 --pretty=format:"%h|%an|%ad|%s" --date=format:"%Y-%m-%d %H:%M"',
      { cwd: __dirname, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim()

    if (!output) return null

    const [hash, author, date, message] = output.split('|')
    return { hash, author, date, message }
  } catch (err) {
    // Git n'est pas installé ou projet pas versionné → OK, on ignore
    return null
  }
}

// ==================== LECTURE BRANCHE GIT ====================

export function getGitBranch() {
  try {
    const output = execSync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: __dirname, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim()
    return output || null
  } catch {
    return null
  }
}

// ==================== RÉSUMÉ COMPLET ====================

export function getSystemInfo() {
  const version = getAppVersion()
  const git = getGitInfo()
  const branch = getGitBranch()

  return {
    version,
    git,
    branch,
    startedAt: new Date().toISOString(),
  }
}

// ==================== LOG AU DÉMARRAGE ====================

export function logStartup(db, logAction) {
  const info = getSystemInfo()

  const details = []
  details.push(`Version ${info.version}`)

  if (info.branch) {
    details.push(`Branche: ${info.branch}`)
  }
  if (info.git) {
    details.push(`Commit: ${info.git.hash} par ${info.git.author}`)
    details.push(`"${info.git.message}"`)
    details.push(`le ${info.git.date}`)
  }

  const detailsStr = details.join(' • ')

  logAction(null, 'Système', 'startup', 'system', null, detailsStr)

  // Log console joli
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log(`🚀 HealthTicket v${info.version}`)
  if (info.git) {
    console.log(`📦 Commit ${info.git.hash} (${info.branch || 'no-branch'})`)
    console.log(`👤 ${info.git.author} — ${info.git.date}`)
    console.log(`📝 "${info.git.message}"`)
  } else {
    console.log('ℹ️  Git non disponible — version manuelle uniquement')
  }
  console.log('═══════════════════════════════════════════════')
  console.log('')

  return info
}