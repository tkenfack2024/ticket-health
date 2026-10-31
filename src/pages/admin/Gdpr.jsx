import { useState, useEffect } from 'react'
import {
  FileText, Plus, Edit, Trash2, Download, X, Loader2, AlertTriangle,
  Shield, ChevronRight, CheckCircle,
} from 'lucide-react'
import { api } from '../../api'

// ==================== COMPOSANT PRINCIPAL ====================

export default function AdminGdpr() {
  const [activeTab, setActiveTab] = useState('register')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FileText size={22} className="text-blue-600 dark:text-blue-400" />
          RGPD
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Registre des traitements &amp; Analyses d'impact
        </p>
      </div>

      {/* 2 onglets horizontaux */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Registre (Art. 30)
          </button>
          <button
            onClick={() => setActiveTab('dpia')}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'dpia'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield size={16} />
            AIPD / DPIA (Art. 35)
          </button>
        </div>
      </div>

      {activeTab === 'register' && <RegisterTab />}
      {activeTab === 'dpia' && <DpiaTab />}
    </div>
  )
}

// ==================== ONGLET 1 : REGISTRE ====================

function RegisterTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dpiaProcessing, setDpiaProcessing] = useState(null) // traitement pour lequel on génère une AIPD

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.gdprGetProcessing()
      setItems(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (item) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    try {
      await api.gdprDeleteProcessing(item.id)
      load()
    } catch (err) { alert(err.message) }
  }

  const handleExport = () => window.open(api.gdprExportUrl(), '_blank')

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {items.length} traitement(s) — Article 30 du RGPD
        </p>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Download size={16} />Exporter CSV
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} />Nouveau traitement
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">📋 Qu'est-ce qu'un registre des traitements ?</p>
        <p className="text-blue-800 dark:text-blue-400">Document obligatoire (article 30 GDPR) qui recense tous les traitements de données personnelles avec leur finalité, base légale, durée de conservation et mesures de sécurité.</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
            item.is_sensitive ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</h3>
                  {item.is_sensitive === 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      <AlertTriangle size={11} />Données sensibles
                    </span>
                  )}
                </div>
                {item.description && <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{item.description}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-xs">
                  {item.data_categories && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Données traitées</p><p className="text-slate-700 dark:text-slate-300">{item.data_categories}</p></div>}
                  {item.purpose && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Finalité</p><p className="text-slate-700 dark:text-slate-300">{item.purpose}</p></div>}
                  {item.legal_basis && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Base légale</p><p className="text-slate-700 dark:text-slate-300">{item.legal_basis}</p></div>}
                  {item.data_subjects && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Personnes concernées</p><p className="text-slate-700 dark:text-slate-300">{item.data_subjects}</p></div>}
                  {item.recipients && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Destinataires</p><p className="text-slate-700 dark:text-slate-300">{item.recipients}</p></div>}
                  {item.retention_period && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Conservation</p><p className="text-slate-700 dark:text-slate-300">{item.retention_period}</p></div>}
                  {item.security_measures && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Sécurité</p><p className="text-slate-700 dark:text-slate-300">{item.security_measures}</p></div>}
                  {item.data_location && <div><p className="text-slate-500 dark:text-slate-400 uppercase font-medium mb-0.5">Localisation</p><p className="text-slate-700 dark:text-slate-300">{item.data_location}</p></div>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setDpiaProcessing(item)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                  title="Générer l'AIPD"
                >
                  <Shield size={16} />
                </button>
                <button onClick={() => { setEditing(item); setShowModal(true) }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Modifier"><Edit size={16} /></button>
                <button onClick={() => handleDelete(item)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Supprimer"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && <GdprModal item={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSuccess={() => { setShowModal(false); setEditing(null); load() }} />}
      {dpiaProcessing && <DpiaModal processing={dpiaProcessing} onClose={() => setDpiaProcessing(null)} onSuccess={() => { setDpiaProcessing(null); }} />}
    </div>
  )
}

// ==================== ONGLET 2 : AIPD / DPIA (placeholder) ====================

function DpiaTab() {
  const [dpias, setDpias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await api.gdprGetAllDpia()
      setDpias(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleValidate = async (dpia) => {
    if (!confirm(`Valider l'AIPD pour "${dpia.processing_name}" ?`)) return
    try {
      await api.gdprValidateDpia(dpia.id, { decision: 'validated', comments: 'Validé depuis la liste' })
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleGenerateReport = (dpia) => {
    // Utilisation de jsPDF (déjà installé pour les ordonnances)
    // On importe dynamiquement pour ne pas alourdir le bundle initial
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()

      // Couleurs
      const blue = [30, 90, 160]
      const dark = [15, 23, 42]
      const gray = [100, 116, 139]

      // Header
      doc.setFillColor(...blue)
      doc.rect(0, 0, pageW, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('HealthTicket — Hôpital Alpha', 14, 14)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Analyse d\'Impact sur la Protection des Données (AIPD)', 14, 19.5)

      // Titre
      doc.setTextColor(...dark)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('AIPD — ' + dpia.processing_name, 14, 34)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gray)
      doc.text('Généré le ' + new Date().toLocaleDateString('fr-FR') + ' • Statut : ' + dpia.status, 14, 40)

      let y = 50

      // Bloc Risque global
      let risks = []
if (Array.isArray(dpia.risks)) {
  risks = dpia.risks
} else {
  try { risks = dpia.risks ? JSON.parse(dpia.risks) : [] } catch { risks = [] }
}
      const avgScore = risks.length > 0 ? risks.reduce((a, r) => a + (r.gravity * r.probability), 0) / risks.length : 0
      const riskLabel = avgScore >= 15 ? 'Critique' : avgScore >= 10 ? 'Élevé' : avgScore >= 5 ? 'Moyen' : 'Faible'

      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(245, 248, 252)
      doc.roundedRect(14, y, pageW - 28, 16, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...dark)
      doc.text('Risque global :', 18, y + 6)
      doc.setTextColor(avgScore >= 10 ? 220 : 22, avgScore >= 10 ? 38 : 163, avgScore >= 10 ? 38 : 74)
      doc.text(`${riskLabel} (${avgScore.toFixed(1)} / 25)`, 60, y + 6)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`${risks.length} risque(s) identifié(s)`, 18, y + 12)

      y += 24

      // Détail des risques
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...dark)
      doc.text('Détail des risques', 14, y)
      y += 6

      doc.setFontSize(9)
      for (const r of risks) {
        if (y > 250) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.text(r.name, 18, y)
        doc.setFont('helvetica', 'normal')
        const score = r.gravity * r.probability
        doc.text(`Gravité: ${r.gravity} | Probabilité: ${r.probability} | Score: ${score}/25 | Résiduel: ${r.residual}`, 18, y + 4.5)
        if (r.measures) {
          doc.setTextColor(...gray)
          doc.text(`Mesures : ${r.measures}`, 18, y + 9)
          doc.setTextColor(...dark)
        }
        y += 14
      }

      // Signature
      if (dpia.dpo_name) {
        if (y > 240) { doc.addPage(); y = 20 }
        y += 10
        doc.setDrawColor(180, 180, 180)
        doc.line(pageW - 70, y, pageW - 14, y)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(dpia.dpo_name, pageW - 42, y + 5, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('DPO — ' + (dpia.dpo_validated_at || ''), pageW - 42, y + 9, { align: 'center' })
      }

      // Footer
      doc.setFontSize(7.5)
      doc.setTextColor(150, 150, 150)
      doc.text('Document confidentiel — HealthTicket', pageW / 2, 285, { align: 'center' })

      doc.save(`AIPD_${dpia.processing_name.replace(/[^a-z0-9]/gi, '_')}.pdf`)
    }).catch(err => {
      alert('Erreur génération PDF : ' + err.message)
    })
  }

  if (loading) return <div className="p-6 text-slate-500 dark:text-slate-400">Chargement...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {dpias.length} AIPD — {dpias.filter(d => d.status === 'validated').length} validée(s)
        </p>
      </div>

      {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {dpias.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Shield size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Aucune AIPD enregistrée</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Générez-en une depuis l'onglet Registre en cliquant sur 🛡️.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dpias.map((dpia) => {
            let risks = []
if (Array.isArray(dpia.risks)) {
  risks = dpia.risks
} else {
  try { risks = dpia.risks ? JSON.parse(dpia.risks) : [] } catch { risks = [] }
}
            const avgScore = risks.length > 0 ? risks.reduce((a, r) => a + (r.gravity * r.probability), 0) / risks.length : 0
            const riskLabel = avgScore >= 15 ? 'Critique' : avgScore >= 10 ? 'Élevé' : avgScore >= 5 ? 'Moyen' : 'Faible'
            const riskColor = avgScore >= 15 ? 'text-red-600' : avgScore >= 10 ? 'text-orange-600' : avgScore >= 5 ? 'text-amber-600' : 'text-green-600'

            const statusConfig = {
              draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
              in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
              validated: { label: 'Validée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
              rejected: { label: 'Rejetée', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
            }[dpia.status] || { label: dpia.status, color: 'bg-slate-100' }

            return (
              <div key={dpia.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{dpia.processing_name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                      {dpia.processing_is_sensitive === 1 && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Sensible</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Risque global : <span className={`font-bold ${riskColor}`}>{riskLabel}</span> ({avgScore.toFixed(1)} / 25) • {risks.length} risque(s)
                    </p>
                    {dpia.dpo_name && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Validée par {dpia.dpo_name} le {dpia.dpo_validated_at}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleGenerateReport(dpia)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg" title="Télécharger le rapport PDF">
                      <Download size={16} />
                    </button>
                    {dpia.status !== 'validated' && (
                      <button onClick={() => handleValidate(dpia)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Valider (DPO)">
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== MODALE AIPD (placeholder) ====================

function DpiaModal({ processing, onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Étape 1 : Contexte
  const [context, setContext] = useState({
    scope: '',
    volume: '',
    duration: '',
    transfer: false,
  })

  // Étape 2 : Risques
  const defaultRisks = [
    { id: 'access', name: 'Accès non autorisé', gravity: 4, probability: 3, measures: 'RBAC, chiffrement AES', residual: 2 },
    { id: 'loss', name: 'Perte de données (ransomware)', gravity: 4, probability: 2, measures: 'Backups quotidiens', residual: 1 },
    { id: 'breach', name: 'Fuite de données', gravity: 5, probability: 2, measures: 'Chiffrement, MFA', residual: 2 },
  ]
  const [risks, setRisks] = useState(defaultRisks)

  // Étape 3 : Mesures
  const defaultMeasures = [
    { id: 'encryption', label: 'Chiffrement AES-256', checked: true },
    { id: 'rbac', label: 'RBAC (contrôle d\'accès)', checked: true },
    { id: 'logs', label: 'Journalisation', checked: true },
    { id: 'backup', label: 'Sauvegardes', checked: true },
    { id: 'mfa', label: 'Authentification multifacteur (MFA)', checked: false },
    { id: 'training', label: 'Formation du personnel', checked: false },
  ]
  const [measures, setMeasures] = useState(defaultMeasures)

  // Étape 4 : Validation
  const [validation, setValidation] = useState({
    dpo_name: '',
    comments: '',
  })

  const [savedDpiaId, setSavedDpiaId] = useState(null)

  // Calcul du score global
  const globalScore = risks.reduce((acc, r) => acc + (r.gravity * r.probability), 0) / (risks.length || 1)
  const globalRiskLabel = globalScore >= 15 ? 'Critique' : globalScore >= 10 ? 'Élevé' : globalScore >= 5 ? 'Moyen' : 'Faible'
  const globalRiskColor = globalScore >= 15 ? 'text-red-600' : globalScore >= 10 ? 'text-orange-600' : globalScore >= 5 ? 'text-amber-600' : 'text-green-600'

  // Mettre à jour un risque
  const updateRisk = (id, field, value) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, [field]: parseInt(value) || 0 } : r))
  }

  // Étape 1 → 2
  const nextFromContext = () => {
    if (!context.scope.trim()) {
      setError('Le périmètre est obligatoire')
      return
    }
    setError(null)
    setStep(2)
  }

  // Étape 4 → 5 (Sauvegarde)
  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Créer ou récupérer l'AIPD
      let dpiaId = savedDpiaId
      if (!dpiaId) {
        const created = await api.gdprCreateDpia(processing.id, {
          context,
          risks,
          security_measures: measures,
        })
        dpiaId = created.id
        setSavedDpiaId(dpiaId)
      } else {
        // Mettre à jour
        await api.gdprUpdateDpia(dpiaId, {
          context,
          risks,
          security_measures: measures,
        })
      }

      // 2. Si le DPO a validé, on valide
      if (validation.dpo_name.trim()) {
        await api.gdprValidateDpia(dpiaId, {
          decision: 'validated',
          comments: validation.comments,
        })
      }

      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full my-8 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Shield size={20} className="text-purple-600" />
              AIPD — {processing.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Étape {step} sur 5</p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {/* Barre de progression */}
        <div className="flex px-6 pt-4 gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>

        {/* Contenu scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

          {/* ÉTAPE 1 : Contexte */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">1. Contexte du traitement</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Décrivez le périmètre et les caractéristiques du traitement.</p>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Périmètre *</label>
                <textarea required rows={3} value={context.scope} onChange={e => setContext({ ...context, scope: e.target.value })} className="input-dark resize-none" placeholder="Ex: Ensemble des dossiers patients du service de médecine générale..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volume de données</label>
                  <input type="text" value={context.volume} onChange={e => setContext({ ...context, volume: e.target.value })} className="input-dark" placeholder="Ex: 5000 patients" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durée de conservation</label>
                  <input type="text" value={context.duration} onChange={e => setContext({ ...context, duration: e.target.value })} className="input-dark" placeholder="Ex: 10 ans" />
                </div>
              </div>

              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                <input type="checkbox" checked={context.transfer} onChange={e => setContext({ ...context, transfer: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Transfert de données hors UE (Turso, Render...)</span>
              </label>
            </div>
          )}

          {/* ÉTAPE 2 : Risques */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">2. Évaluation des risques</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pour chaque risque, évaluez la gravité (1-5) et la probabilité (1-5).</p>

              <div className="space-y-3">
                {risks.map(r => {
                  const score = r.gravity * r.probability
                  const scoreColor = score >= 15 ? 'text-red-600' : score >= 8 ? 'text-orange-600' : 'text-green-600'
                  return (
                    <div key={r.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                        <span className={`font-bold ${scoreColor}`}>{score} / 25</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Gravité : {r.gravity}</label>
                          <input type="range" min="1" max="5" value={r.gravity} onChange={e => updateRisk(r.id, 'gravity', e.target.value)} className="w-full" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Probabilité : {r.probability}</label>
                          <input type="range" min="1" max="5" value={r.probability} onChange={e => updateRisk(r.id, 'probability', e.target.value)} className="w-full" />
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Mesures existantes :</span> {r.measures}
                      </div>
                      <div className="mt-2">
                        <label className="block text-xs text-slate-500 mb-1">Risque résiduel après mesures : {r.residual}</label>
                        <input type="range" min="1" max="5" value={r.residual} onChange={e => updateRisk(r.id, 'residual', e.target.value)} className="w-full" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : Mesures */}
          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">3. Mesures de sécurité en place</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Cochez les mesures actuellement déployées.</p>

              <div className="space-y-2">
                {measures.map(m => (
                  <label key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    m.checked ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600'
                  }`}>
                    <input type="checkbox" checked={m.checked} onChange={e => setMeasures(prev => prev.map(x => x.id === m.id ? { ...x, checked: e.target.checked } : x))} className="w-4 h-4" />
                    <span className={`text-sm ${m.checked ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ÉTAPE 4 : Validation DPO */}
          {step === 4 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">4. Validation par le DPO</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Optionnel : si le DPO est présent, il peut valider directement.</p>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom du DPO</label>
                <input type="text" value={validation.dpo_name} onChange={e => setValidation({ ...validation, dpo_name: e.target.value })} className="input-dark" placeholder="Laissez vide pour enregistrer en brouillon" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Commentaires</label>
                <textarea rows={3} value={validation.comments} onChange={e => setValidation({ ...validation, comments: e.target.value })} className="input-dark resize-none" placeholder="Avis du DPO..." />
              </div>
            </div>
          )}

          {/* ÉTAPE 5 : Résumé */}
          {step === 5 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">5. Résumé et validation</h4>

              <div className={`p-4 rounded-lg border ${globalScore >= 15 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : globalScore >= 10 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                <p className="text-sm font-medium">Risque global du traitement</p>
                <p className={`text-2xl font-bold mt-1 ${globalRiskColor}`}>{globalRiskLabel} ({globalScore.toFixed(1)} / 25)</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-sm space-y-2">
                <p><strong className="text-slate-700 dark:text-slate-300">Périmètre :</strong> {context.scope}</p>
                <p><strong className="text-slate-700 dark:text-slate-300">Risques identifiés :</strong> {risks.length}</p>
                <p><strong className="text-slate-700 dark:text-slate-300">Mesures déployées :</strong> {measures.filter(m => m.checked).length} / {measures.length}</p>
                {validation.dpo_name && <p><strong className="text-slate-700 dark:text-slate-300">DPO :</strong> {validation.dpo_name}</p>}
                {validation.comments && <p><strong className="text-slate-700 dark:text-slate-300">Commentaires :</strong> {validation.comments}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
          >
            Annuler
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={loading}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
              >
                Précédent
              </button>
            )}

            {step < 5 ? (
              <button
                onClick={step === 1 ? nextFromContext : () => setStep(step + 1)}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Suivant <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Enregistrement...' : 'Enregistrer l\'AIPD'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== MODALE REGISTRE (existante) ====================

function GdprModal({ item, onClose, onSuccess }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name || '', description: item?.description || '',
    data_categories: item?.data_categories || '', purpose: item?.purpose || '',
    legal_basis: item?.legal_basis || '', data_subjects: item?.data_subjects || '',
    recipients: item?.recipients || '', retention_period: item?.retention_period || '',
    security_measures: item?.security_measures || '', data_location: item?.data_location || '',
    is_sensitive: item?.is_sensitive === 1 || false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isEdit) await api.gdprUpdateProcessing(item.id, form)
      else await api.gdprCreateProcessing(form)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8 border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{isEdit ? `Modifier : ${item.name}` : 'Nouveau traitement'}</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-dark resize-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Données traitées</label><input type="text" value={form.data_categories} onChange={(e) => setForm({ ...form, data_categories: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Finalité</label><input type="text" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="input-dark" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base légale</label><input type="text" value={form.legal_basis} onChange={(e) => setForm({ ...form, legal_basis: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Personnes concernées</label><input type="text" value={form.data_subjects} onChange={(e) => setForm({ ...form, data_subjects: e.target.value })} className="input-dark" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destinataires</label><input type="text" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} className="input-dark" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conservation</label><input type="text" value={form.retention_period} onChange={(e) => setForm({ ...form, retention_period: e.target.value })} className="input-dark" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localisation</label><input type="text" value={form.data_location} onChange={(e) => setForm({ ...form, data_location: e.target.value })} className="input-dark" /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mesures de sécurité</label><textarea rows={2} value={form.security_measures} onChange={(e) => setForm({ ...form, security_measures: e.target.value })} className="input-dark resize-none" /></div>
          <div>
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
              <input type="checkbox" checked={form.is_sensitive} onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })} className="w-4 h-4" />
              <AlertTriangle size={16} className="text-orange-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Ce traitement concerne des données sensibles</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}