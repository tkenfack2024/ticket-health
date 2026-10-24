import { useState, useEffect, useRef } from 'react'
import { Server, Box, Search, X, ChevronRight, AlertTriangle, MapPin, User, Hash, Package } from 'lucide-react'
import { api } from '../api'

const TYPE_CONFIG = {
  hardware: { icon: Server, label: 'Hardware', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  software: { icon: Box, label: 'Software', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

export default function AssetSelector({ value, onChange, placeholder = "Sélectionner un équipement...", disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const searchInputRef = useRef(null)
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      loadAssets()
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (value && !selectedAsset) {
      api.getAssetsFull().then(data => {
        const asset = data.find(a => a.id === value)
        if (asset) setSelectedAsset(asset)
      }).catch(console.error)
    } else if (!value) { setSelectedAsset(null) }
  }, [value])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const data = await api.getAssetsFull()
      setAssets(data)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const filteredAssets = assets.filter(asset => {
    if (filterType !== 'all' && asset.type !== filterType) return false
    if (search) {
      const s = search.toLowerCase()
      return asset.name?.toLowerCase().includes(s) || asset.serial_number?.toLowerCase().includes(s) || asset.brand?.toLowerCase().includes(s) || asset.model?.toLowerCase().includes(s) || asset.editor?.toLowerCase().includes(s)
    }
    return true
  })

  const groupedAssets = { hardware: filteredAssets.filter(a => a.type === 'hardware'), software: filteredAssets.filter(a => a.type === 'software') }

  const handleSelect = (asset) => {
    setSelectedAsset(asset)
    onChange(asset.id)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setSelectedAsset(null)
    onChange(null)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const renderSelectorButton = () => {
    if (selectedAsset) {
      const typeConf = TYPE_CONFIG[selectedAsset.type] || TYPE_CONFIG.hardware
      const Icon = typeConf.icon
      return (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
          <div className={`p-2 rounded-lg ${typeConf.color}`}><Icon size={18} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{selectedAsset.name}</p>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              {selectedAsset.serial_number && <span className="flex items-center gap-1"><Hash size={10} />{selectedAsset.serial_number}</span>}
              {selectedAsset.brand && <span>{selectedAsset.brand}</span>}
              {selectedAsset.editor && <span>{selectedAsset.editor} {selectedAsset.version}</span>}
              {selectedAsset.ci_id && <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_CONFIG[selectedAsset.type]?.color || ''}`}>CI lié</span>}
            </div>
          </div>
          {!disabled && <button onClick={handleClear} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Retirer"><X size={16} /></button>}
        </div>
      )
    }

    return (
      <button type="button" onClick={() => !disabled && setIsOpen(true)} disabled={disabled}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
        <Package size={18} />{placeholder}
      </button>
    )
  }

  return (
    <>
      {renderSelectorButton()}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div ref={modalRef} className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Package size={18} className="text-blue-600 dark:text-blue-400" />
                  Sélectionner un équipement ou logiciel
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input ref={searchInputRef} type="text" placeholder="Rechercher par nom, n° série, marque, éditeur..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-dark pl-10" />
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'all', label: `Tout (${assets.length})`, icon: null },
                  { id: 'hardware', label: `Hardware (${assets.filter(a => a.type === 'hardware').length})`, icon: Server },
                  { id: 'software', label: `Software (${assets.filter(a => a.type === 'software').length})`, icon: Box },
                ].map((tab) => {
                  const TabIcon = tab.icon
                  return (
                    <button key={tab.id} onClick={() => setFilterType(tab.id)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        filterType === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}>
                      {TabIcon && <TabIcon size={12} />}{tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                  <p>Chargement...</p>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun équipement trouvé</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">{search ? 'Essayez un autre mot-clé' : 'Aucun asset enregistré'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedAssets.hardware.length > 0 && (filterType === 'all' || filterType === 'hardware') && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Server size={14} />Hardware ({groupedAssets.hardware.length})
                      </h4>
                      <div className="space-y-2">{groupedAssets.hardware.map((asset) => <AssetRow key={asset.id} asset={asset} onSelect={handleSelect} />)}</div>
                    </div>
                  )}
                  {groupedAssets.software.length > 0 && (filterType === 'all' || filterType === 'software') && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Box size={14} />Software ({groupedAssets.software.length})
                      </h4>
                      <div className="space-y-2">{groupedAssets.software.map((asset) => <AssetRow key={asset.id} asset={asset} onSelect={handleSelect} />)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AssetRow({ asset, onSelect }) {
  const typeConf = TYPE_CONFIG[asset.type] || TYPE_CONFIG.hardware
  const Icon = typeConf.icon
  const isOutOfService = asset.status === 'En panne' || asset.status === 'Hors service' || asset.status === 'Réformé'

  return (
    <button onClick={() => onSelect(asset)} className="w-full text-left flex items-center gap-3 p-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg transition-all group">
      <div className={`p-2.5 rounded-lg ${typeConf.color} flex-shrink-0`}><Icon size={20} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{asset.name}</p>
          {isOutOfService && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle size={9} />{asset.status}</span>}
          {asset.ci_id && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">CI lié</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          {asset.serial_number && <span className="flex items-center gap-1"><Hash size={11} /><span className="font-mono">{asset.serial_number}</span></span>}
          {asset.brand && <span>{asset.brand}</span>}
          {asset.model && <span>{asset.model}</span>}
          {asset.editor && <span>{asset.editor} {asset.version}</span>}
          {asset.location && <span className="flex items-center gap-1"><MapPin size={11} />{asset.location}</span>}
          {asset.assigned_to_name && <span className="flex items-center gap-1"><User size={11} />{asset.assigned_to_name}</span>}
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 transition-colors" />
    </button>
  )
}