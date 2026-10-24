import { useState, useEffect } from 'react'
import { Clock, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function AdminWaitingRoom() {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.visitsGetAll({ status: 'En attente' })
      setVisits(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // NOUVELLE FONCTION : Prendre en charge ET rediriger
  const handleStart = async (visitId, patientId) => {
    try {
      // 1. On dit au serveur de changer le statut de la visite
      await api.visitsStart(visitId)
      // 2. On redirige le médecin vers le dossier médical du patient
      navigate(`/admin/patients/${patientId}/records`)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Clock size={22} className="text-amber-500" />
          Salle d'attente
        </h2>
        <p className="text-slate-500 text-sm mt-1">Patients en attente de consultation</p>
      </div>

      {loading ? <div>Chargement...</div> : (
        <div className="space-y-3">
          {visits.length === 0 ? (
             <div className="bg-white p-8 text-center rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800">Aucun patient dans la salle d'attente.</div>
          ) : (
            visits.map(v => (
              <div key={v.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                    {v.first_name[0]}{v.last_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{v.last_name} {v.first_name} <span className="text-xs font-mono text-slate-400">({v.patient_code})</span></h3>
                    <p className="text-sm text-slate-500">Motif : {v.reason} • Arrivé à {new Date(v.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>
                
                {/* BOUTON QUI APPELLE LA NOUVELLE FONCTION */}
                <button 
                  onClick={() => handleStart(v.id, v.patient_id)} 
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Play size={16} /> Prendre en charge
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}