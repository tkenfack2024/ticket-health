import { useState, useEffect } from 'react'
import { Bed, Armchair, Plus, Search, Edit2, Trash2, X, Loader2, MapPin } from 'lucide-react'
import { api } from '../../api'

export default function AdminResources() {
  const [resources, setResources] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBookingsModal, setShowBookingsModal] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  useEffect(() => {
    load()
    loadRooms()
  }, [filterType])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.resourcesGetAll({ type: filterType || undefined })
      setResources(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadRooms = async () => {
    try {
      const sites = await api.facilityGetTree()
      const allRooms = []
      sites.forEach(site => {
        site.floors.forEach(floor => {
          floor.rooms.forEach(room => {
            allRooms.push({ ...room, fullName: `${site.name} > ${floor.name} > ${room.name}` })
          })
        })
      })
      setRooms(allRooms)
    } catch (err) {
      console.error('Erreur chargement salles', err)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette ressource ?')) return
    await api.resourcesDelete(id)
    load()
  }

  const filtered = resources.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.unique_code.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bed size={22} className="text-teal-600" />
            Lits & Tables de travail
          </h2>
          <p className="text-slate-500 text-sm mt-1">Gestion des ressources physiques hospitalières</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBookingsModal(true)} className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 text-sm font-medium">
            Voir les réservations
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(true) }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus size={16} /> Nouvelle ressource
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher par code ou nom..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-dark max-w-[200px]">
          <option value="">Tous les types</option>
          <option value="Lit">Lits</option>
          <option value="Table de travail">Tables de travail</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {r.type === 'Lit' ? <Bed className="text-blue-500" size={20} /> : <Armchair className="text-orange-500" size={20} />}
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{r.unique_code}</h3>
                  <p className="text-xs text-slate-500">{r.type} - {r.name}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditItem(r); setShowModal(true) }} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <MapPin size={12} /> {r.site_name ? `${r.site_name} > ${r.floor_name} > ${r.room_name}` : 'Non localisé'}
            </div>
            
            <div className="mt-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                r.status === 'Disponible' ? 'bg-green-100 text-green-700' :
                r.status === 'Occupé' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ResourceModal
          item={editItem}
          rooms={rooms}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}

      {showBookingsModal && (
        <BookingsListModal onClose={() => setShowBookingsModal(false)} />
      )}

    </div>
  )
}

function ResourceModal({ item, rooms, onClose, onSuccess }) {
  const [form, setForm] = useState({
    type: item?.type || 'Lit',
    name: item?.name || '',
    unique_code: item?.unique_code || '',
    room_id: item?.room_id || '',
    status: item?.status || 'Disponible'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!item && !form.unique_code) {
      const prefix = form.type === 'Lit' ? 'LIT-' : 'TAB-'
      const random = Math.floor(100 + Math.random() * 900)
      setForm(f => ({ ...f, unique_code: `${prefix}${random}` }))
    }
  }, [form.type, item])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (item) await api.resourcesUpdate(item.id, form)
      else await api.resourcesCreate(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">
          {item ? 'Modifier la ressource' : 'Nouvelle ressource'}
        </h3>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Type *</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-dark">
                <option value="Lit">Lit d'hôpital</option>
                <option value="Table de travail">Table de travail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Code Unique *</label>
              <input required type="text" value={form.unique_code} onChange={e => setForm({...form, unique_code: e.target.value})} className="input-dark font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nom / Description</label>
            <input type="text" placeholder="Ex: Lit médicalisé 2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-dark" />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Salle d'affectation</label>
            <select value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})} className="input-dark">
              <option value="">Non localisé</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Statut</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-dark">
              <option value="Disponible">Disponible</option>
              <option value="Occupé">Occupé</option>
              <option value="En maintenance">En maintenance</option>
              <option value="Hors service">Hors service</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
              {loading ? <Loader2 className="animate-spin m-auto" size={18}/> : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BookingsListModal({ onClose }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.resourcesGetBookings()
      .then(data => { setBookings(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Filtrage par nom de patient, nom du réservateur ou code de la ressource
  const filteredBookings = bookings.filter(b => {
    if (!search) return true
    const q = search.toLowerCase()
    const patient = (b.patient_name || '').toLowerCase()
    const user = (b.user_name || '').toLowerCase()
    const resource = (b.unique_code || '').toLowerCase()
    return patient.includes(q) || user.includes(q) || resource.includes(q)
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-5xl w-full p-6 border border-slate-200 dark:border-slate-700 my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Registre des réservations</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Barre de recherche */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par patient, réservateur ou code ressource..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
        </div>
        
        {loading ? <p className="text-center text-slate-500">Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Ressource</th>
                  <th className="px-4 py-3">Date/Slot</th>
                  <th className="px-4 py-3">Réservé par</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Naissance</th>
                  <th className="px-4 py-3 rounded-tr-lg">Séjour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">
                      Aucune réservation trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">{b.unique_code}</td>
                      <td className="px-4 py-3">{b.booking_date} ({b.slot})</td>
                      
                      {/* NOUVELLE COLONNE : Réservé par */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {b.user_name || '-'}
                      </td>

                      <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{b.patient_name || '-'}</td>
                      <td className="px-4 py-3">{b.patient_dob || '-'}</td>
                      <td className="px-4 py-3 text-xs">{b.start_date ? `${b.start_date} au ${b.end_date}` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}