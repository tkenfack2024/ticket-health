import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Activity, Mail, Lock, KeyRound, Loader2, Moon, Sun } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

// Calcule la route de destination selon le rôle ET les permissions granulaires
function getTargetPath(user, redirectTo) {
  const hasAnyPermission = Array.isArray(user.permissions) && user.permissions.length > 0
  const canAccessBackOffice =
    user.role === 'admin' || user.role === 'technicien' || hasAnyPermission

  if (canAccessBackOffice) {
    return redirectTo && redirectTo !== '/' ? redirectTo : '/'
  }
  return '/portal'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const redirectTo = location.state?.from?.pathname || '/'

    const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.login({ email, password })
      // On attend que login() récupère les permissions
      const freshUser = await login(res.user, res.token)
      
      const hasAnyPermission = Array.isArray(freshUser.permissions) && freshUser.permissions.length > 0
      const canAccessBackOffice = freshUser.role === 'admin' || freshUser.role === 'technicien' || hasAnyPermission
      
      const targetPath = canAccessBackOffice
        ? (redirectTo && redirectTo !== '/' ? redirectTo : '/')
        : '/portal'
        
      navigate(targetPath, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await api.requestOtp(email)
      setOtpSent(true)
      setInfo('Code envoyé à votre adresse email. Vérifiez votre boîte (et le dossier spam).')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.verifyOtp(email, otpCode)
      login(res.user, res.token)
      navigate(getTargetPath(res.user, redirectTo), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 transition-colors relative">
      {/* Toggle thème en haut à droite */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title={isDark ? 'Mode clair' : 'Mode sombre'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-3" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">HealthTicket</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Connectez-vous à votre compte</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
          {/* Onglets */}
          <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null); setInfo(null) }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'password'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Mot de passe
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setError(null); setInfo(null) }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'otp'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Code par email
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg text-sm">
              {info}
            </div>
          )}

          {/* Mode password */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Se connecter
              </button>
            </form>
          )}

          {/* Mode OTP */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Recevoir un code
              </button>
            </form>
          )}

          {mode === 'otp' && otpSent && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Code reçu par email
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 chiffres"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(''); setInfo(null) }}
                className="w-full text-slate-500 dark:text-slate-400 text-sm hover:underline"
              >
                ← Changer d'email
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}