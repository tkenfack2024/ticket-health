import { Clock, AlertTriangle, CheckCircle, Pause, Calendar, Timer } from 'lucide-react'

function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return '-'
  const abs = Math.abs(minutes)
  if (abs < 60) return abs + 'min'
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? h + 'h' : h + 'h ' + m + 'min'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function SlaPanel({ ticket }) {
  if (!ticket || !ticket.sla_resolution_deadline) {
    return (
      <div className="p-6 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Clock size={18} className="text-slate-400" />
          SLA
        </h2>
        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500">
          Aucun SLA defini pour ce ticket.
        </div>
      </div>
    )
  }

  const status = ticket.sla_status || 'ok'
  const deadline = new Date(ticket.sla_resolution_deadline).getTime()
  const now = Date.now()
  const diffMinutes = Math.round((deadline - now) / 60000)

  const config = {
    ok: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      badge: 'bg-green-100 text-green-700',
      icon: CheckCircle,
      label: 'Dans les temps',
    },
    'menacé': {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
      label: 'SLA menace',
    },
    'dépassé': {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      badge: 'bg-red-100 text-red-700',
      icon: AlertTriangle,
      label: 'SLA depasse',
    },
    'en pause': {
      bg: 'bg-slate-50 border-slate-200',
      text: 'text-slate-800',
      badge: 'bg-slate-100 text-slate-600',
      icon: Pause,
      label: 'SLA en pause',
    },
    'respecté': {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      badge: 'bg-green-100 text-green-700',
      icon: CheckCircle,
      label: 'SLA respecte',
    },
  }

  const c = config[status] || config.ok
  const Icon = c.icon

  return (
    <div className="p-6 border-b border-slate-200">
      <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <Clock size={18} className="text-slate-600" />
        SLA
      </h2>

      <div className={'rounded-lg border p-4 ' + c.bg}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ' + c.badge}>
            <Icon size={14} />
            {c.label}
          </span>

          {ticket.sla_escalated === 1 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
              Escalade
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Calendar size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Deadline resolution</p>
              <p className={'font-medium ' + c.text}>
                {formatDate(ticket.sla_resolution_deadline)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Timer size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                {status === 'dépassé' ? 'Depassement' : status === 'en pause' ? 'SLA en pause' : 'Temps restant'}
              </p>
              <p className={'font-medium ' + c.text}>
                {status === 'en pause' ? '-' :
                  status === 'dépassé' ? formatMinutes(Math.abs(diffMinutes)) :
                  status === 'respecté' ? 'Resolu a temps' :
                  formatMinutes(diffMinutes)
                }
              </p>
            </div>
          </div>

          {ticket.sla_paused_total_minutes > 0 && (
            <div className="flex items-start gap-2">
              <Pause size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Pause cumulee</p>
                <p className="font-medium text-slate-700">
                  {formatMinutes(ticket.sla_paused_total_minutes)}
                </p>
              </div>
            </div>
          )}

          {ticket.resolved_at && (
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Resolu le</p>
                <p className="font-medium text-slate-700">{formatDate(ticket.resolved_at)}</p>
              </div>
            </div>
          )}
        </div>

        {status === 'en pause' && (
          <p className="text-xs text-slate-500 mt-3 italic">
            Le SLA est en pause tant que le ticket est en attente de reponse du client.
          </p>
        )}
      </div>
    </div>
  )
}
