import { useState } from 'react'
import { Users, Clock, Pill } from 'lucide-react'
import AdminPatients from './Patients'
import AdminWaitingRoom from './WaitingRoom'
import AdminMedicalFollowUp from './MedicalFollowUp'

const TABS = [
  { id: 'patients', label: 'Accueil Patients', icon: Users },
  { id: 'waiting-room', label: "Salle d'attente", icon: Clock },
  { id: 'followup', label: 'Suivi Médical', icon: Pill },
]

export default function AdminDpi() {
  const [activeTab, setActiveTab] = useState('patients')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestion DPI</h1>
          <p className="text-slate-500 dark:text-slate-400">Dossiers patients, salle d'attente et suivi</p>
        </div>

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
          {activeTab === 'patients' && <AdminPatients />}
          {activeTab === 'waiting-room' && <AdminWaitingRoom />}
          {activeTab === 'followup' && <AdminMedicalFollowUp />}
        </div>
      </div>
    </div>
  )
}