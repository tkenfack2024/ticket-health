import { useState, useEffect } from 'react'
import { Building2, Plus, MapPin, Layers, DoorOpen, Loader2, X } from 'lucide-react'
import { api } from '../../api'

export default function AdminFacility() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('site') // 'site', 'floor', 'room'
  const [targetId, setTargetId] = useState(null) // Pour lier un étage à un site, ou une salle à un étage

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.facilityGetTree()
      setSites(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openAdd = (type, id = null) => {
    setModalType(type)
    setTargetId(id)
    setShowModal(true)
  }

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 size={22} className="text-blue-600" />
            Gestion Immobilière
          </h2>
          <p className="text-slate-500 text-sm mt-1">Sites, Bâtiments et Salles</p>
        </div>
        <button onClick={() => openAdd('site')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Nouveau Site
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Building2 size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Aucun site enregistré. Commencez par créer un bâtiment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sites.map(site => (
            <div key={site.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <MapPin size={18} className="text-blue-500" />
                  {site.name} <span className="text-xs font-normal text-slate-500">({site.address || 'Pas d\'adresse'})</span>
                </div>
                <button onClick={() => openAdd('floor', site.id)} className="text-xs px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50">+ Étages</button>
              </div>
              <div className="p-4 space-y-4">
                {site.floors.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucun étage défini.</p>
                ) : (
                  site.floors.map(floor => (
                    <div key={floor.id} className="ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-600">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          <Layers size={14} /> {floor.name}
                        </div>
                        <button onClick={() => openAdd('room', floor.id)} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">+ Salles</button>
                      </div>
                      {floor.rooms.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {floor.rooms.map(room => (
                            <div key={room.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded border border-slate-100 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300">
                              <DoorOpen size={12} className="text-slate-400" />
                              <div>
                                <p className="font-medium">{room.name}</p>
                                <p className="text-[10px] text-slate-400">{room.type} • {room.code || 'Sans code'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <FacilityModal
          type={modalType}
          targetId={targetId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function FacilityModal({ type, targetId, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', address: '', code: '', roomType: 'Bureau', capacity: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (type === 'site') {
        await api.facilityCreateSite({ name: form.name, address: form.address })
      } else if (type === 'floor') {
        await api.facilityCreateFloor({ site_id: targetId, name: form.name })
      } else if (type === 'room') {
        await api.facilityCreateRoom({ floor_id: targetId, name: form.name, type: form.roomType, code: form.code, capacity: form.capacity })
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">
          {type === 'site' ? 'Nouveau Site' : type === 'floor' ? 'Nouvel Étages' : 'Nouvelle Salle'}
        </h3>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nom *</label>
            <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-dark" />
          </div>
          {type === 'site' && (
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Adresse</label>
              <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-dark" />
            </div>
          )}
          {type === 'room' && (
            <>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Type de salle *</label>
                <select value={form.roomType} onChange={e => setForm({...form, roomType: e.target.value})} className="input-dark">
                  <option value="Bureau">Bureau</option>
                  <option value="Magasin">Magasin</option>
                  <option value="Salle de réunion">Salle de réunion</option>
                  <option value="Salle d'opération">Salle d'opération</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Code de la salle (ex: OP-01)</label>
                <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="input-dark" />
              </div>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">
              {loading ? <Loader2 className="animate-spin m-auto" size={18}/> : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}