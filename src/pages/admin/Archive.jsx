import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Trash2, Archive as ArchiveIcon, AlertTriangle } from 'lucide-react'
import { api } from '../../api'

const PRIORITY_COLORS = {
  Urgente: 'bg-red-100 text-red-700',
  Haute: 'bg-orange-100 text-orange-700',
  Moyenne: 'bg-yellow-100 text-yellow-700',
  Basse: 'bg-slate-100 text-slate-600',
}

const STATUS_COLORS = {
  Ouvert: 'bg-blue-100 text-blue-700',
  'En cours': 'bg-amber-100 text-amber-700',
  Résolu: 'bg-green-100 text-green-700',
}

export default function AdminArchive() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.adminGetArchivedTickets()
      setTickets(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRestore = async (ticket) => {
    if (!confirm(`Restaurer le ticket "${ticket.title}" ?`)) return
    try {
      await api.adminRestoreTicket(ticket.id)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeleteForever = async () => {
    if (!confirmDelete) return
    try {
      await api.adminDeleteTicket(confirmDelete.id)
      setConfirmDelete(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Chargement...</div>

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Tickets archivés</h2>
        <p className="text-slate-500 text-sm">{tickets.length} ticket(s) archivé(s)</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <ArchiveIcon size={32} className="mx-auto mb-2 text-slate-300" />
          Aucun ticket archivé.
          <p className="text-xs mt-2">
            Les tickets que vous archivez apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Priorité</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Archivé le</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-slate-800 hover:text-blue-600 text-sm"
                    >
                      {ticket.title}
                    </Link>
                    <p className="text-xs text-slate-500">{ticket.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[ticket.status] || ''}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    {ticket.archived_at || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRestore(ticket)}
                        title="Restaurer"
                        className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(ticket)}
                        title="Supprimer définitivement"
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Supprimer définitivement ?</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-red-800">{confirmDelete.title}</p>
              <p className="text-xs text-red-600 mt-1">
                Ticket #{confirmDelete.id} — Tous les commentaires seront aussi supprimés.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteForever}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium text-sm"
              >
                Supprimer
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-slate-200 py-2 rounded-lg hover:bg-slate-50 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}