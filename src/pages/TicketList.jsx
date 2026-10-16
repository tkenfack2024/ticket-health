import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import SlaBadge from '../components/SlaBadge'
import { api } from '../api'

export default function TicketList() {
  const [tickets, setTickets] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Tous')
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

  const filtered = tickets.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'Tous' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  if (loading) {
    return <div className="p-8 text-slate-500">Chargement des tickets...</div>
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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tous les tickets</h1>
          <p className="text-slate-500">{filtered.length} ticket(s) trouvé(s)</p>
        </div>
        <Link
          to="/tickets/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Nouveau ticket
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>Tous</option>
          <option>Ouvert</option>
          <option>En cours</option>
          <option>En attente client</option>
          <option>Résolu</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Ticket</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Catégorie</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Priorité</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">SLA</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Statut</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Assigné</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                  Aucun ticket trouvé. Créez-en un !
                </td>
              </tr>
            ) : (
              filtered.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link to={`/tickets/${ticket.id}`} className="font-medium text-blue-600 hover:underline">
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{ticket.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ticket.priority === 'Urgente' ? 'bg-red-100 text-red-700' :
                      ticket.priority === 'Haute' ? 'bg-orange-100 text-orange-700' :
                      ticket.priority === 'Moyenne' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <SlaBadge ticket={ticket} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ticket.status === 'Ouvert' ? 'bg-blue-100 text-blue-700' :
                      ticket.status === 'En cours' ? 'bg-amber-100 text-amber-700' :
                      ticket.status === 'En attente client' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{ticket.assignee}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{ticket.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}