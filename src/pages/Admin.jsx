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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Administration</h1>
        <p className="text-slate-500">Gérez les utilisateurs, modules, assets et plus</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
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
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'users' && <AdminUsers />}
      {activeTab === 'permissions' && <AdminPermissions />}
      {activeTab === 'modules' && <AdminModules />}
      {activeTab === 'assets' && <AdminAssets />}
      {activeTab === 'sla' && <AdminSla />}
      {activeTab === 'logs' && <AdminLogs />}
      {activeTab === 'archive' && <AdminArchive />}
      {activeTab === 'gdpr' && <AdminGdpr />}
      {activeTab === 'cmdb' && <AdminCmdb />}
      {activeTab === 'problems' && <AdminProblems />}
    </div>
  )
}