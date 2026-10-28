// src/pages/TicketList.jsx
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import SlaBadge from '../components/SlaBadge'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function TicketList() {
  const { user } = useAuth()
  const location = useLocation()
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Tous')
  const [filterSource, setFilterSource] = useState('Tous')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const PAGE_SIZE = 15

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/tickets?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      setTickets(res.data || [])
      setTotal(res.total || 0)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, location.key])

  useEffect(() => {
    setPage(0)
  }, [search, filterStatus, filterSource])

  // Filtrage local (sur la page courante)
  const filtered = (tickets || []).filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'Tous' || t.status === filterStatus
    const matchSource = 
      filterSource === 'Tous' || 
      (filterSource === 'Catalogue' && t.title.startsWith('[Demande]')) ||
      (filterSource === 'Manuel' && !t.title.startsWith('[Demande]'))
    return matchSearch && matchStatus && matchSource
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading && tickets.length === 0) {
    return <div className="p-8 text-slate-500 dark:text-slate-400">Chargement des tickets...</div>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {user?.role === 'admin' ? 'Tous les tickets' :
             user?.role === 'technicien' ? 'Tickets assignés' :
             'Mes tickets'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">{total} ticket(s) au total</p>
        </div>
        <Link
          to="/tickets/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Nouveau ticket
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Rechercher un ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Tous">Tous les statuts</option>
          <option value="Ouvert">Ouvert</option>
          <option value="En cours">En cours</option>
          <option value="En attente client">En attente client</option>
          <option value="Résolu">Résolu</option>
        </select>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Tous">Toutes les sources</option>
          <option value="Catalogue">Catalogue (Demandes)</option>
          <option value="Manuel">Créés manuellement</option>
        </select>
      </div>

      {/* Tableau des tickets */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Ticket</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Catégorie</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Priorité</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">SLA</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Statut</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Assigné</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500 dark:text-slate-300">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  Aucun ticket trouvé sur cette page.
                </td>
              </tr>
            ) : (
              filtered.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/tickets/${ticket.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {ticket.title}
                    </Link>
                    {ticket.title.startsWith('[Demande]') && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Catalogue
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ticket.priority === 'Urgente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      ticket.priority === 'Haute' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      ticket.priority === 'Moyenne' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <SlaBadge ticket={ticket} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ticket.status === 'Ouvert' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      ticket.status === 'En cours' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      ticket.status === 'En attente client' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.assignee}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{ticket.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {page + 1} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} /> Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}