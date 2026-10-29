import { useState, useEffect } from 'react'
import { Pill, Microscope, CheckCircle, Clock, Upload, X, Loader2 } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function AdminMedicalFollowUp() {
  const { hasPermission } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('prescriptions')
  const [selectedExam, setSelectedExam] = useState(null) 

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [prescData, examData] = await Promise.all([
        api.prescriptionsGetPending(),
        api.examsGetPending()
      ])
      setPrescriptions(prescData)
      setExams(examData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFinishPrescription = async (id) => {
    try {
      await api.prescriptionsFinish(id)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-8">Chargement...</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Clock size={22} className="text-blue-600" />
          Suivi Médical
        </h2>
        <p className="text-slate-500 text-sm mt-1">Prise en charge des patients (Pharmacie & Laboratoire)</p>
      </div>

      {/* Onglets */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
        <button 
          onClick={() => setActiveTab('prescriptions')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'prescriptions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Pill size={18} /> Ordonnances en cours ({prescriptions.length})
        </button>
        <button 
          onClick={() => setActiveTab('exams')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'exams' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Microscope size={18} /> Examens à réaliser ({exams.length})
        </button>
      </div>

      {/* Contenu */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="text-slate-500 italic">Aucune ordonnance active.</div>
          ) : (
            prescriptions.map(p => (
              <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{p.last_name} {p.first_name} <span className="text-xs font-mono text-slate-400">({p.patient_code})</span></h3>
                  <p className="text-sm text-blue-600 font-medium mt-1">💊 {p.medication} - {p.dosage} ({p.duration})</p>
                </div>
                {hasPermission('prescriptions.finish') && (
                  <button onClick={() => handleFinishPrescription(p.id)} className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 hover:text-white transition-colors">
                    <CheckCircle size={16} /> Marquer administrée
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="space-y-3">
          {exams.length === 0 ? (
            <div className="text-slate-500 italic">Aucun examen en attente.</div>
          ) : (
            exams.map(e => (
              <div key={e.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{e.last_name} {e.first_name} <span className="text-xs font-mono text-slate-400">({e.patient_code})</span></h3>
                  <p className="text-sm text-purple-600 font-medium mt-1">🔬 {e.exam_type}</p>
                </div>
                {hasPermission('exams.update') && (
                  <button 
                    onClick={() => setSelectedExam(e)}
                    className="flex items-center gap-2 bg-purple-50 text-purple-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 hover:text-white transition-colors"
                  >
                    <Upload size={16} /> Uploader résultat
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODALE RÉSULTAT EXAMEN */}
      {selectedExam && (
        <ExamResultModal
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
          onSuccess={() => { setSelectedExam(null); loadData() }}
        />
      )}
    </div>
  )
}

// ============ MODALE RÉSULTAT EXAMEN ============
function ExamResultModal({ exam, onClose, onSuccess }) {
  const [status, setStatus] = useState('Résultat disponible')
  const [resultNotes, setResultNotes] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // On passe file en 3ème argument
      await api.examsUpdate(exam.id, { status, result_notes: resultNotes }, file)
      onSuccess()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 my-8">
        
        {/* Header de la modale */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Résultat de l'examen</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
          Patient : <strong>{exam.last_name} {exam.first_name}</strong><br/>
          Examen : <strong>{exam.exam_type}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Champ Fichier (maintenant bien placé) */}
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Fichier (PDF, JPG - Max 5Mo)</label>
            <input 
              type="file" 
              onChange={e => setFile(e.target.files[0])}
              className="input-dark file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-dark">
              <option value="En cours">En cours d'analyse</option>
              <option value="Résultat disponible">Résultat disponible (Terminé)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Notes / Résultats</label>
            <textarea 
              rows={4} 
              value={resultNotes} 
              onChange={e => setResultNotes(e.target.value)} 
              className="input-dark resize-none" 
              placeholder="Ex: Taux de globules blancs élevé..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Enregistrement...' : 'Enregistrer le résultat'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}