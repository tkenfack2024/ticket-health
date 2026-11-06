import { useState, useEffect } from 'react'
import { Shield, Key, CheckCircle, AlertTriangle, Loader2, XCircle, Copy, Check, Download } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function Security() {
  const { user } = useAuth()
  const [step, setStep] = useState(1) // 1: Intro/Statut, 2: QR Code, 3: Succès
  const [isEnabled, setIsEnabled] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('') // Pour désactiver
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Vérifier le statut au chargement
  useEffect(() => {
    api.get('/api/auth/mfa/status')
      .then(res => {
        setIsEnabled(res.enabled)
        if (res.enabled) setStep(3) // Si déjà activé, on va à l'écran "Succès"
      })
      .catch(() => {})
  }, [])

  const handleStartSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/mfa/setup')
      setQrCode(res.qrCode)
      setSecret(res.secret)
      setRecoveryCodes(res.recoveryCodes)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/mfa/verify', { code })
      setStep(3)
      setIsEnabled(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ✅ NOUVEAU : Copier les codes de secours
  const handleCopyCodes = async () => {
    try {
      const text = `HealthTicket - Codes de secours MFA\n` +
                   `Compte : ${user?.email || ''}\n` +
                   `Générés le : ${new Date().toLocaleString('fr-FR')}\n\n` +
                   `⚠️ Ces codes sont à usage unique. Conservez-les en lieu sûr.\n\n` +
                   recoveryCodes.join('\n') +
                   `\n\nUn code utilisé ne pourra plus jamais être réutilisé.`
      await navigator.clipboard.writeText(text)
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    } catch (err) {
      alert('Impossible de copier dans le presse-papier. Sélectionne les codes manuellement.')
    }
  }

  // ✅ NOUVEAU : Télécharger les codes en .txt
  const handleDownloadCodes = () => {
    const text = `=====================================\n` +
                 `   HEALTHTICKET — CODES DE SECOURS MFA\n` +
                 `=====================================\n\n` +
                 `Compte    : ${user?.email || ''}\n` +
                 `Nom       : ${user?.name || ''}\n` +
                 `Générés le: ${new Date().toLocaleString('fr-FR')}\n\n` +
                 `⚠️  IMPORTANT\n` +
                 `─────────────────────────────────────\n` +
                 `• Chaque code ne peut être utilisé QU'UNE SEULE FOIS\n` +
                 `• Conservez ce fichier en lieu sûr (gestionnaire de mots de passe, coffre-fort)\n` +
                 `• Ne le partagez JAMAIS\n` +
                 `• Après usage, le code est automatiquement supprimé\n\n` +
                 `─────────────────────────────────────\n` +
                 `VOS 8 CODES DE SECOURS :\n` +
                 `─────────────────────────────────────\n\n` +
                 recoveryCodes.map((c, i) => `  ${String(i + 1).padStart(2, '0')}.  ${c}`).join('\n') +
                 `\n\n─────────────────────────────────────\n` +
                 `Si vous perdez votre téléphone ET vos codes de secours,\n` +
                 `contactez un administrateur pour désactiver votre MFA.\n` +
                 `─────────────────────────────────────\n`

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `healthticket-codes-secours-${(user?.email || 'mfa').split('@')[0]}-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDisable = async (e) => {
    e.preventDefault()
    if (!confirm('Voulez-vous vraiment désactiver le MFA ? Votre compte sera moins sécurisé.')) return
    
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/mfa/disable', { password })
      setStep(1)
      setIsEnabled(false)
      setPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Shield size={26} className="text-blue-600" />
          Sécurité du compte
        </h1>
        <p className="text-slate-500 text-sm mt-1">Gérez l'authentification à deux facteurs (MFA)</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* ÉTAPE 1 : Intro (si non activé) */}
      {step === 1 && !isEnabled && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Key className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100">
                Authentification à deux facteurs (MFA)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Ajoutez une couche de sécurité supplémentaire à votre compte. 
                Après votre mot de passe, vous devrez saisir un code généré par une application sur votre téléphone.
              </p>
              
              <button
                onClick={handleStartSetup}
                disabled={loading}
                className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Activer le MFA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : QR Code et vérification */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4">
            1. Scannez ce QR Code
          </h2>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-center mb-6">
            <img src={qrCode} alt="QR Code MFA" className="w-64 h-64 mx-auto" />
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span>Secret : <span className="font-mono">{secret}</span></span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret)
                    setCopiedSecret(true)
                    setTimeout(() => setCopiedSecret(false), 2000)
                  } catch {}
                }}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                title="Copier le secret"
              >
                {copiedSecret ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4">
            2. Conservez vos codes de secours
          </h2>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg mb-6">
            <p className="text-sm text-orange-800 dark:text-orange-300 font-medium mb-2 flex items-center gap-2">
              <AlertTriangle size={16} /> Ces codes ne seront plus jamais affichés !
            </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs mb-4">
              {recoveryCodes.map((c, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-2 rounded border border-orange-200 dark:border-orange-700 text-center">
                  {c}
                </div>
              ))}
            </div>

            {/* ✅ NOUVEAU : Boutons Copier / Télécharger */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyCodes}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copiedCodes
                    ? 'bg-green-600 text-white'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                {copiedCodes ? <Check size={16} /> : <Copy size={16} />}
                {copiedCodes ? 'Copié !' : 'Copier les codes'}
              </button>
              <button
                onClick={handleDownloadCodes}
                className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <Download size={16} />
                Télécharger .txt
              </button>
            </div>
          </div>

          <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4">
            3. Validez l'activation
          </h2>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Code à 6 chiffres généré par votre application
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Valider et activer le MFA
            </button>
          </form>
        </div>
      )}

      {/* ÉTAPE 3 : Déjà activé (ou succès) */}
      {step === 3 && isEnabled && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="text-center mb-8">
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              MFA Activé
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Votre compte est protégé par l'authentification à deux facteurs.
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <XCircle size={18} className="text-red-500" /> Désactiver le MFA
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Pour désactiver le MFA, confirmez votre mot de passe actuel.
            </p>
            <form onSubmit={handleDisable} className="flex gap-2">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={loading || !password}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                Désactiver
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}