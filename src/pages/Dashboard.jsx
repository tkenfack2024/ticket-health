import { useState, useEffect } from 'react'
import { Ticket, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import SlaStatsCard from '../components/SlaStatsCard'

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getTickets()
      .then(data => {
        setTickets(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="p-8 text-slate-500">Chargement du tableau de bord...</div>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
          <p className="text-sm mt-1">
            Vérifie que le backend tourne bien sur <code>http://localhost:3001</code>
          </p>
        </div>
      </div>
    )
  }

  // Calcul dynamique des stats
  const stats = [
    {
      label: 'Ouverts',
      value: tickets.filter(t => t.status === 'Ouvert').length,
      icon: Ticket,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'En cours',
      value: tickets.filter(t => t.status === 'En cours').length,
      icon: Clock,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Résolus',
      value: tickets.filter(t => t.status === 'Résolu').length,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Urgents',
      value: tickets.filter(t => t.priority === 'Urgente' && t.status !== 'Résolu').length,
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-600',
    },
  ]

  // 4 derniers tickets (déjà triés DESC par l'API)
  const recentTickets = tickets.slice(0, 4)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Tableau de bord</h1>
        <p className="text-slate-500">Bienvenue dans le système de gestion de tickets</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

{/* Statistiques SLA */}
<SlaStatsCard />

      {/* Tickets récents */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Tickets récents</h2>
          <Link to="/tickets" className="text-blue-600 text-sm hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentTickets.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Aucun ticket pour le moment.{' '}
              <Link to="/tickets/new" className="text-blue-600 hover:underline">
                Créez-en un !
              </Link>
            </div>
          ) : (
            recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-800">{ticket.title}</p>
                  <p className="text-sm text-slate-500">{ticket.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    ticket.priority === 'Urgente' ? 'bg-red-100 text-red-700' :
                    ticket.priority === 'Haute' ? 'bg-orange-100 text-orange-700' :
                    ticket.priority === 'Moyenne' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {ticket.priority}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    ticket.status === 'Ouvert' ? 'bg-blue-100 text-blue-700' :
                    ticket.status === 'En cours' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}