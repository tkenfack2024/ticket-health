// src/pages/Ressources.jsx
import { useState } from 'react'
import { Building, Bed } from 'lucide-react'
import Facility from './admin/Facility'
import Resources from './admin/Resources'

const TABS = [
  { id: 'facility', label: 'Bâtiments & Salles', icon: Building },
  { id: 'resources', label: 'Lits & Tables', icon: Bed },
]

export default function Ressources() {
  const [activeTab, setActiveTab] = useState('facility')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestion des Ressources</h1>
          <p className="text-slate-500 dark:text-slate-400">Bâtiments, salles et ressources physiques</p>
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
        <div className="pt-6 text-slate-800 dark:text-slate-100">
          {activeTab === 'facility' && <Facility />}
          {activeTab === 'resources' && <Resources />}
        </div>
      </div>
    </div>
  )
}