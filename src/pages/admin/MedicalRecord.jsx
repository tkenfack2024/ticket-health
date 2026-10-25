// src/pages/admin/MedicalRecord.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Activity, FileText, Clock, Printer, Download } from 'lucide-react'
import { api } from '../../api'
import { generateOrdonnancePDF } from '../../utils/pdfGenerator'
import { mapConsultationToPdf } from '../../utils/mapConsultation'

export default function MedicalRecord() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const [showConsultModal, setShowConsultModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [selectedRecordForExam, setSelectedRecordForExam] = useState(null)

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [patientsData, recordsData] = await Promise.all([
        api.patientsGetAll(),
        api.recordsGetAll(id)
      ])
      const currentPatient = patientsData.find(p => p.id === parseInt(id))
      setPatient(currentPatient)
      setRecords(recordsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Génération du PDF d'ordonnance
  const handleGenerateOrdonnance = async (record, mode = 'print') => {
    try {
      // Récupérer toutes les prescriptions de cette consultation
      let prescriptions = []
      try {
        prescriptions = await api.prescriptionsGet(record.id)
      } catch (e) {
        console.warn('Impossible de charger les prescriptions :', e.message)
      }

      if (!prescriptions || prescriptions.length === 0) {
        const ok = window.confirm(
          "Aucune prescription n'est associée à cette consultation.\n" +
          "Générer quand même l'ordonnance (sans médicaments) ?"
        )
        if (!ok) return
      }

      const payload = mapConsultationToPdf(patient, record, prescriptions)

      generateOrdonnancePDF(payload, {
        print: mode === 'print',
        download: mode === 'download',
        filename: `ordonnance_${patient.patient_code || patient.last_name}_${record.id}.pdf`,
      })
    } catch (e) {
      console.error('Erreur génération ordonnance:', e)
      alert("Impossible de générer l'ordonnance : " + e.message)
    }
  }

  if (loading) return <div className="p-8">Chargement...</div>
  if (!patient) return <div className="p-8">Patient non trouvé.</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/admin/waiting-room" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 text-sm font-medium">
        <ArrowLeft size={16} /> Retour à la salle d'attente
      </Link>

      {/* En-tête Patient */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-2xl">
              {patient.first_name[0]}{patient.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{patient.last_name} {patient.first_name}</h1>
              <p className="text-sm font-mono text-slate-500">{patient.patient_code} • Né(e) le {new Date(patient.dob).toLocaleDateString('fr-FR')}</p>

              {patient.allergies && (
                <div className="mt-2 inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                  ⚠️ Allergies : {patient.allergies}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowConsultModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2">
            <Activity size={16} /> Nouvelle Consultation
          </button>
        </div>
      </div>

      {/* Historique */}
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Clock size={20} /> Historique des consultations
      </h2>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        {records.length === 0 ? (
          <div className="text-slate-500 italic text-sm pl-12">Aucune consultation enregistrée.</div>
        ) : (
          records.map(r => (
            <div key={r.id} className="relative pl-12">
              <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-blue-100 border-4 border-white dark:border-slate-900 flex items-center justify-center text-blue-600">
                <FileText size={16} />
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">
                      Consultation du {new Date(r.created_at).toLocaleDateString('fr-FR')} à {new Date(r.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                    </h3>
                    <p className="text-xs text-slate-500">Par Dr. {r.doctor_name}</p>
                  </div>
                </div>
                <div className="space-y-2 mt-3 text-sm">
                  <p><strong className="text-slate-700 dark:text-slate-300">Motif :</strong> {r.chief_complaint}</p>
                  <p><strong className="text-slate-700 dark:text-slate-300">Diagnostic :</strong> {r.diagnosis}</p>
                  {r.notes && <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded mt-2 whitespace-pre-line">{r.notes}</p>}
                </div>

                {/* Boutons */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2 flex-wrap">
                  <button onClick={() => setSelectedRecord(r.id)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 font-medium transition-colors">
                    + Ordonnance
                  </button>
                  <button onClick={() => setSelectedRecordForExam(r.id)} className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded hover:bg-purple-100 font-medium transition-colors">
                    + Demander un examen
                  </button>

                  {/* Bouton Imprimer l'ordonnance PDF */}
                  <button
                    onClick={() => handleGenerateOrdonnance(r, 'print')}
                    className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-600 hover:text-white font-medium transition-colors flex items-center gap-1"
                    title="Ouvrir la boîte d'impression de l'ordonnance"
                  >
                    <Printer size={12} /> Imprimer l'ordonnance
                  </button>

                  {/* Bouton Télécharger PDF */}
                  <button
                    onClick={() => handleGenerateOrdonnance(r, 'download')}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-700 hover:text-white font-medium transition-colors flex items-center gap-1"
                    title="Télécharger l'ordonnance au format PDF"
                  >
                    <Download size={12} /> PDF
                  </button>
                </div>

                {/* Examens */}
                {r.exams && r.exams.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Examens demandés</h4>
                    <div className="space-y-2">
                      {r.exams.map(e => (
                        <div key={e.id} className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{e.exam_type}</span>
                          {e.status === 'Résultat disponible' ? (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-green-600 font-bold">✅ {e.status}</span>
                              {e.file_name && (
                                <a href={api.examsDownloadUrl(e.id)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                  📄 Télécharger le fichier
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 font-bold">⏳ {e.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODALES */}
      {showConsultModal && (
        <ConsultationModal
          patientId={id}
          onClose={() => setShowConsultModal(false)}
          onSuccess={() => { setShowConsultModal(false); loadData() }}
        />
      )}

      {selectedRecord && (
        <PrescriptionModal
          recordId={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onSuccess={() => { setSelectedRecord(null); loadData() }}
        />
      )}

      {selectedRecordForExam && (
        <ExamModal
          recordId={selectedRecordForExam}
          onClose={() => setSelectedRecordForExam(null)}
          onSuccess={() => { setSelectedRecordForExam(null); loadData() }}
        />
      )}
    </div>
  )
}

// ============ MODALE CONSULTATION ============
function ConsultationModal({ patientId, onClose, onSuccess }) {
  const [form, setForm] = useState({ chief_complaint: '', diagnosis: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.recordsCreate(patientId, form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100">Nouvelle Consultation</h3>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Motif de consultation *</label>
            <input required type="text" value={form.chief_complaint} onChange={e => setForm({...form, chief_complaint: e.target.value})} className="input-dark" placeholder="Ex: Douleurs abdominales" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Diagnostic *</label>
            <input required type="text" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} className="input-dark" placeholder="Ex: Appendicite aiguë" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Notes cliniques (Chiffrées)</label>
            <textarea rows={4} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-dark resize-none" placeholder="Observations, prescriptions manuelles..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              {loading ? 'Enregistrement...' : 'Valider la consultation'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODALE ORDONNANCE ============
function PrescriptionModal({ recordId, onClose, onSuccess }) {
  const [form, setForm] = useState({ medication: '', dosage: '', duration: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.prescriptionsCreate(recordId, form)
      onSuccess()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">Nouvelle Ordonnance</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="text" placeholder="Médicament (ex: Doliprane)" value={form.medication} onChange={e => setForm({...form, medication: e.target.value})} className="input-dark w-full" />
          <input required type="text" placeholder="Dosage (ex: 1g, 3 fois par jour)" value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} className="input-dark w-full" />
          <input type="text" placeholder="Durée (ex: 5 jours)" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="input-dark w-full" />
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">Enregistrer</button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ MODALE EXAMEN ============
function ExamModal({ recordId, onClose, onSuccess }) {
  const [examType, setExamType] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.examsCreate(recordId, { exam_type: examType })
      onSuccess()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-100">Demande d'examen</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="text" placeholder="Ex: Prise de sang, Radio..." value={examType} onChange={e => setExamType(e.target.value)} className="input-dark w-full" />
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium">Demander</button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}