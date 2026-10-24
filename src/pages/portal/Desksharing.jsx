import { useState, useEffect } from 'react'
import { Calendar, Armchair, Bed, MapPin, CheckCircle, XCircle, Loader2, ShieldAlert } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function Desksharing() {
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [bookings, setBookings] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(null)
  
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedResource, setSelectedResource] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  useEffect(() => {
    loadData()
  }, [date])

  const loadData = async () => {
    try {
    setLoading(true)
      const [resData, bookingsData] = await Promise.all([
        api.resourcesGetAll(), // On charge TOUT (Lits et Tables)
        api.resourcesGetBookings({ date })
      ])
      setResources(resData)
      setBookings(bookingsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBookClick = (resource, slot) => {
    setSelectedResource(resource)
    setSelectedSlot(slot)
    setShowBookingModal(true)
  }

  const confirmBooking = async (formData) => {
    setBookingLoading(`${selectedResource.id}-${selectedSlot}`)
    try {
      await api.resourcesBook(selectedResource.id, { 
        booking_date: date, 
        slot: selectedSlot,
        ...formData
      })
      setShowBookingModal(false)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setBookingLoading(null)
    }
  }

  const handleCancel = async (bookingId) => {
    if (!confirm('Annuler cette réservation ?')) return
    try {
      await api.resourcesCancelBooking(bookingId)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const getBooking = (tableId, slot) => {
    return bookings.find(b => b.resource_id === tableId && b.slot === slot)
  }

  // Séparation des lits et des tables
  const tables = resources.filter(r => r.type === 'Table de travail')
  const beds = resources.filter(r => r.type === 'Lit')

  if (loading) return <div className="p-8 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" /> Chargement...</div>

  const renderResourceCard = (resource) => {
    const isBed = resource.type === 'Lit'
    return (
      <div key={resource.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
        <div className={`p-4 border-b border-slate-100 dark:border-slate-700 ${isBed ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-slate-50 dark:bg-slate-700/30'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 font-mono tracking-tight">{resource.unique_code}</h3>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-0.5">{resource.name}</p>
            </div>
            <div className={`p-2 rounded-lg ${isBed ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
              {isBed ? <Bed size={20} /> : <Armchair size={20} />}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-3">
            <MapPin size={14} className="text-slate-400" />
            <span className="truncate">{resource.site_name} • {resource.floor_name} • {resource.room_name}</span>
          </div>
        </div>
        
        <div className="p-4 space-y-3 flex-1 flex flex-col justify-center bg-white dark:bg-slate-800">
          {['Matin', 'Après-midi'].map(slot => {
            const existing = getBooking(resource.id, slot)
            const isMine = existing && existing.user_id === user?.id

            return (
              <div key={slot} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-24">{slot}</span>
                  {existing && (
                     <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                       {isMine ? 'Vous' : 'Occupé'}
                     </span>
                  )}
                </div>
                
                {!existing ? (
                  <button 
                    onClick={() => handleBookClick(resource, slot)}
                    disabled={bookingLoading === `${resource.id}-${slot}`}
                    className="text-xs px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-blue-100 hover:border-blue-600"
                  >
                    {bookingLoading === `${resource.id}-${slot}` ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                    Réserver
                  </button>
                ) : isMine ? (
                  <button 
                    onClick={() => handleCancel(existing.id)} 
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  >
                    <XCircle size={14}/> Annuler
                  </button>
                ) : (
                  <button disabled className="text-xs px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg font-medium cursor-not-allowed flex items-center gap-1.5">
                    <XCircle size={14}/> Réservé
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
            <Armchair size={24} />
          </div>
          Réservation & Occupation
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Réservez une table de travail ou gérez l'occupation des lits.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="text-slate-400" size={20} />
          <span className="font-medium text-slate-700 dark:text-slate-300">Date :</span>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            className="input-dark max-w-[200px] font-medium" 
          />
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <ShieldAlert size={16} />
          {user?.role === 'admin' || user?.role === 'technicien' ? 'Accès médical accordé' : 'Accès utilisateur standard'}
        </div>
      </div>

      {/* SECTION TABLES */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Armchair size={20} className="text-slate-400" /> Tables de travail ({tables.length})
        </h2>
        {tables.length === 0 ? (
           <p className="text-sm text-slate-500 italic">Aucune table disponible.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map(renderResourceCard)}
          </div>
        )}
      </div>

      {/* SECTION LITS */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Bed size={20} className="text-blue-500" /> Lits d'hôpitaux ({beds.length})
        </h2>
        {beds.length === 0 ? (
           <p className="text-sm text-slate-500 italic">Aucun lit disponible.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {beds.map(renderResourceCard)}
          </div>
        )}
      </div>

      {showBookingModal && (
        <BookingModal
          resource={selectedResource}
          slot={selectedSlot}
          date={date}
          onClose={() => setShowBookingModal(false)}
          onConfirm={confirmBooking}
          loading={bookingLoading}
        />
      )}
    </div>
  )
}

function BookingModal({ resource, slot, date, onClose, onConfirm, loading }) {
  const { user } = useAuth()
  const isMedicalStaff = user?.role === 'admin' || user?.role === 'technicien'
  const isBed = resource.type === 'Lit'
  const showPatientForm = isBed && isMedicalStaff
  
  const [form, setForm] = useState({
    patient_name: '',
    patient_dob: '',
    start_date: date,
    end_date: date
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(showPatientForm ? form : {})
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
          {isBed ? <Bed size={18} className="text-blue-500" /> : <Armchair size={18} className="text-orange-500" />}
          Réserver {resource.unique_code} ({slot})
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {showPatientForm ? (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                🔒 Les informations du patient sont chiffrées et visibles uniquement par le personnel de santé.
              </div>
              
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300 font-medium">Nom du patient *</label>
                <input required type="text" value={form.patient_name} onChange={e => setForm({...form, patient_name: e.target.value})} className="input-dark" placeholder="Ex: Jean Dupont" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300 font-medium">Date de naissance *</label>
                <input required type="date" value={form.patient_dob} onChange={e => setForm({...form, patient_dob: e.target.value})} className="input-dark" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300 font-medium">Début séjour</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="input-dark" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300 font-medium">Fin séjour</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="input-dark" />
                </div>
              </div>
            </>
          ) : (
            <div className="py-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Confirmez-vous la réservation de {isBed ? 'ce lit' : 'cette table'} pour le <strong>{new Date(date).toLocaleDateString('fr-FR')}</strong> ({slot}) ?
              </p>
              {isBed && !isMedicalStaff && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-xs text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800">
                  ⚠️ En tant qu'utilisateur standard, vous ne pouvez pas saisir les informations du patient. Contactez le personnel soignant.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
              {loading ? <Loader2 size={16} className="animate-spin m-auto"/> : 'Confirmer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}