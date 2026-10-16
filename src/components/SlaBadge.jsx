import { Clock, AlertTriangle, CheckCircle, Pause, MinusCircle } from 'lucide-react'

// Convertit des minutes en texte "2h 30min" ou "45min"
function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return ''
  const abs = Math.abs(minutes)
  if (abs < 60) return `${abs}min`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export default function SlaBadge({ ticket, compact = false }) {
  if (!ticket.sla_resolution_deadline) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-400">
        <MinusCircle size={12} />
        {!compact && 'Pas de SLA'}
      </span>
    )
  }

  const status = ticket.sla_status || 'ok'
  const deadline = new Date(ticket.sla_resolution_deadline).getTime()
  const now = Date.now()
  const diffMinutes = Math.round((deadline - now) / 60000)

  const config = {
    ok: {
      bg: 'bg-green-100 text-green-700',
      icon: CheckCircle,
      label: diffMinutes > 0 ? `Dans ${formatMinutes(diffMinutes)}` : 'À temps',
    },
    menacé: {
      bg: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
      label: diffMinutes > 0 ? `${formatMinutes(diffMinutes)} restant` : 'Bientôt dépassé',
    },
    dépassé: {
      bg: 'bg-red-100 text-red-700',
      icon: AlertTriangle,
      label: `Dépassé de ${formatMinutes(Math.abs(diffMinutes))}`,
    },
    'en pause': {
      bg: 'bg-slate-100 text-slate-600',
      icon: Pause,
      label: 'En pause',
    },
    respecté: {
      bg: 'bg-green-100 text-green-700',
      icon: CheckCircle,
      label: 'SLA respecté',
    },
  }

  const c = config[status] || config.ok
  const Icon = c.icon

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg}`}
      title={`SLA : ${status}`}
    >
      <Icon size={12} />
      {!compact && c.label}
    </span>
  )
}