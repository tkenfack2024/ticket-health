import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Package } from 'lucide-react'
import AssetSelector from '../components/AssetSelector'
import { api } from '../api'

export default function CreateTicket() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    category: 'Informatique',
    priority: 'Moyenne',
    description: '',
  })

const [assets, setAssets] = useState([])
const [assetsLoading, setAssetsLoading] = useState(false)
const [selectedAssetId, setSelectedAssetId] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

useEffect(() => {
  // Charger les assets quand la catégorie change
  const loadAssets = async () => {
    if (!form.category) {
      setAssets([])
      return
    }
    setAssetsLoading(true)
    try {
      // Charger les assets filtrés par catégorie (nom du module)
      const data = await api.getAssets()
      setAssets(data)
    } catch (err) {
      console.error('Erreur chargement assets:', err)
      setAssets([])
    } finally {
      setAssetsLoading(false)
    }
  }
  loadAssets()
}, [form.category])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await api.createTicket({
  ...form,
  asset_id: selectedAssetId ? parseInt(selectedAssetId) : null,
})
      navigate('/tickets')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft size={18} />
        Retour
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-2">Nouveau ticket</h1>
      <p className="text-slate-500 mb-8">Remplissez le formulaire pour créer une demande</p>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre du ticket *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Imprimante en panne au service Urgences"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Catégorie *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Informatique</option>
              <option>Équipement médical</option>
              <option>Administratif</option>
              <option>Infrastructure</option>
              <option>Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Priorité *</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Basse</option>
              <option>Moyenne</option>
              <option>Haute</option>
              <option>Urgente</option>
            </select>
          </div>
        </div>
	
	<div>
  <label className="block text-sm font-medium text-slate-700 mb-1.5">
    Équipement / Logiciel concerné
  </label>
  <AssetSelector
    value={selectedAssetId}
    onChange={setSelectedAssetId}
    placeholder="Cliquez pour sélectionner un équipement..."
    disabled={assetsLoading}
  />
  <p className="text-xs text-slate-500 mt-1.5">
    Permet au technicien d'identifier précisément l'équipement en panne
  </p>
</div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Décrivez le problème en détail..."
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Création...' : 'Créer le ticket'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={loading}
            className="px-6 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}