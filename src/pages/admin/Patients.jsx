import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, User, Phone, MapPin, Droplet, Activity, Edit2, FileText, Clock, Pill } from 'lucide-react'
import { api } from '../../api'

// ✅ IMPORT DES COMPOSANTS POUR LES AUTRES ONGLETS
import AdminWaitingRoom from './WaitingRoom'
import AdminMedicalFollowUp from './MedicalFollowUp'

const TABS = [
  { id: 'patients', label: 'Accueil Patients', icon: User },
  { id: 'waiting-room', label: "Salle d'attente", icon: Clock },
  { id: 'followup', label: 'Suivi Médical', icon: Pill },
]

// ==========================================
// COMPOSANT PRINCIPAL (AVEC LES ONGLETS)
// ==========================================
export default function AdminDpi() {
  const [activeTab, setActiveTab] = useState('patients')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestion DPI</h1>
          <p className="text-slate-500 dark:text-slate-400">Dossiers patients, salle d'attente et suivi médical</p>
        </div>

        {/* Barre d'onglets horizontale */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="pt-6">
          {activeTab === 'patients' && <PatientsTab />}
          {activeTab === 'waiting-room' && <AdminWaitingRoom />}
          {activeTab === 'followup' && <AdminMedicalFollowUp />}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// LE CONTENU DE L'ONGLET "ACCUEIL PATIENTS"
// ==========================================
function PatientsTab() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  
  const PAGE_SIZE = 12

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.patientsGetAll({ 
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      })
      setPatients(res.data || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    load() 
  }, [search, page])

  useEffect(() => {
    setPage(0)
  }, [search])

  const handleSendToDoctor = async (patientId) => {
    if (!confirm('Envoyer ce patient dans la salle d\'attente du médecin ?')) return
    try {
      await api.visitsCreate(patientId, { reason: 'Consultation générale' })
      alert('Patient envoyé en salle d\'attente !')
    } catch (err) {
      alert(err.message)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <User size={22} className="text-rose-600" />
            Accueil & Patients
          </h2>
          <p className="text-slate-500 text-sm mt-1">{total} patient(s) enregistré(s)</p>
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map(p => (
              <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow flex flex-col">
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
                
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4 flex-1">
                  <p className="flex items-center gap-2"><Activity size={14} /> Né(e) le {new Date(p.dob).toLocaleDateString('fr-FR')}</p>
                  {p.phone && <p className="flex items-center gap-2"><Phone size={14} /> {p.phone}</p>}
                  {p.address && <p className="flex items-center gap-2"><MapPin size={14} /> {p.address}</p>}
                </div>

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

          {patients.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500 italic">Aucun patient trouvé.</div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-500">Page {page + 1} sur {totalPages}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(0, p - 1))} 
                  disabled={page === 0} 
                  className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  ← Précédent
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                  disabled={page >= totalPages - 1} 
                  className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </>
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
// ==========================================
// MODALE PATIENT (INCHANGÉE)
// ==========================================
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
  const [deleting, setDeleting] = useState(false)

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