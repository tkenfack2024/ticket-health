import { useState } from 'react'
import { Users, Puzzle, Package, ScrollText, Archive, Clock, Shield, FileText, Network, Bug } from 'lucide-react'
import AdminUsers from './admin/Users'
import AdminModules from './admin/Modules'
import AdminAssets from './admin/Assets'
import AdminLogs from './admin/Logs'
import AdminArchive from './admin/Archive'
import AdminSla from './admin/Sla'
import AdminPermissions from './admin/Permissions'
import AdminGdpr from './admin/Gdpr'
import AdminCmdb from './admin/Cmdb'
import AdminProblems from './admin/Problems'

const TABS = [
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'modules', label: 'Modules', icon: Puzzle },
  { id: 'assets', label: 'Assets', icon: Package },
  { id: 'cmdb', label: 'CMDB', icon: Network },
  { id: 'problems', label: 'Problèmes', icon: Bug },
  { id: 'sla', label: 'SLA', icon: Clock },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'gdpr', label: 'RGPD', icon: FileText },
]

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="h-full flex flex-col">
      {/* Header + Onglets - STICKY */}
      <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Administration</h1>
          <p className="text-slate-500 dark:text-slate-400">Gérez les utilisateurs, modules, assets et plus</p>
        </div>

        {/* Onglets */}
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

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="pt-6 text-slate-800 dark:text-slate-100">
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'permissions' && <AdminPermissions />}
          {activeTab === 'modules' && <AdminModules />}
          {activeTab === 'assets' && <AdminAssets />}
          {activeTab === 'cmdb' && <AdminCmdb />}
          {activeTab === 'problems' && <AdminProblems />}
          {activeTab === 'sla' && <AdminSla />}
          {activeTab === 'logs' && <AdminLogs />}
          {activeTab === 'archive' && <AdminArchive />}
          {activeTab === 'gdpr' && <AdminGdpr />}
        </div>
      </div>
    </div>
  )
}