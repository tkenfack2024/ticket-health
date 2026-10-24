import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, User, Phone, MapPin, Droplet, Activity, Edit2, FileText } from 'lucide-react'
import { api } from '../../api'

export default function AdminPatients() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  useEffect(() => { load() }, [search])

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.patientsGetAll({ search: search || undefined })
      setPatients(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendToDoctor = async (patientId) => {
    if (!confirm('Envoyer ce patient dans la salle d\'attente du médecin ?')) return
    try {
      await api.visitsCreate(patientId, { reason: 'Consultation générale' })
      alert('Patient envoyé en salle d\'attente !')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <User size={22} className="text-rose-600" />
            Accueil & Patients
          </h2>
          <p className="text-slate-500 text-sm mt-1">Enregistrement des dossiers patients (DPI)</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true) }} className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 text-sm font-medium">
          <UserPlus size={16} /> Nouveau Patient
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher par nom, prénom ou code..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100" />
        </div>
      </div>

      {loading ? <div className="text-slate-500 text-center py-8">Chargement...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow flex flex-col">
              
              {/* En-tête de la carte */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{p.last_name} {p.first_name}</h3>
                    <p className="text-xs font-mono text-slate-500">{p.patient_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.blood_type && (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      <Droplet size={12} /> {p.blood_type}
                    </span>
                  )}
                  <button onClick={() => { setEditItem(p); setShowModal(true) }} className="p-1 text-slate-400 hover:text-blue-600" title="Modifier">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
              
              {/* Infos */}
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4 flex-1">
                <p className="flex items-center gap-2"><Activity size={14} /> Né(e) le {new Date(p.dob).toLocaleDateString('fr-FR')}</p>
                {p.phone && <p className="flex items-center gap-2"><Phone size={14} /> {p.phone}</p>}
                {p.address && <p className="flex items-center gap-2"><MapPin size={14} /> {p.address}</p>}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                <button 
                  onClick={() => navigate(`/admin/patients/${p.id}/records`)}
                  className="w-full bg-slate-50 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={14} /> Voir le dossier médical
                </button>

                <button 
                  onClick={() => handleSendToDoctor(p.id)}
                  className="w-full bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  Envoyer en consultation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PatientModal
          item={editItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function PatientModal({ item, onClose, onSuccess }) {
  const [form, setForm] = useState({
    first_name: item?.first_name || '', 
    last_name: item?.last_name || '', 
    dob: item?.dob || '', 
    gender: item?.gender || 'M', 
    phone: item?.phone || '', 
    address: item?.address || '', 
    nir: item?.nir || '', 
    blood_type: item?.blood_type || '', 
    allergies: item?.allergies || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false) // <-- ICI, dans PatientModal

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (item) {
        await api.patientsUpdate(item.id, form)
      } else {
        await api.patientsCreate(form)
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">
          {item ? 'Modifier le dossier patient' : 'Enregistrer un nouveau patient'}
        </h3>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Nom *</label>
              <input required type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Prénom *</label>
              <input required type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="input-dark" />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Date de naissance *</label>
              <input required type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Sexe</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input-dark">
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Groupe Sanguin</label>
              <input type="text" placeholder="Ex: A+" value={form.blood_type} onChange={e => setForm({...form, blood_type: e.target.value})} className="input-dark" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Téléphone</label>
              <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">NIR (Sécurité Sociale)</label>
              <input type="text" placeholder="Chiffré en base" value={form.nir} onChange={e => setForm({...form, nir: e.target.value})} className="input-dark" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Adresse</label>
            <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-dark" />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Allergies connues (Chiffré)</label>
            <textarea rows={2} value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} className="input-dark resize-none" placeholder="Ex: Pénicilline, Arachides..." />
          </div>

          <div className="flex gap-2 pt-2">
            {item && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Supprimer définitivement le patient ${item.first_name} ${item.last_name} ?`)) return
                  setDeleting(true)
                  try {
                    await api.patientsDelete(item.id)
                    onSuccess()
                  } catch (err) {
                    alert(err.message)
                    setDeleting(false)
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            )}
            <button type="submit" disabled={loading} className="flex-1 bg-rose-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-700">
              {loading ? 'Enregistrement...' : (item ? 'Enregistrer les modifications' : 'Créer le dossier patient')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}