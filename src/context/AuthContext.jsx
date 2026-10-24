import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('ht_token')
      if (savedToken) {
        setToken(savedToken)
        try {
          const freshUser = await api.me()
          setUser(freshUser)
          localStorage.setItem('ht_user', JSON.stringify(freshUser))
        } catch (err) {
          localStorage.removeItem('ht_token')
          localStorage.removeItem('ht_user')
          setUser(null)
          setToken(null)
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  // On rend la fonction login asynchrone pour aller chercher les vraies permissions
  const login = async (userData, userToken) => {
    setToken(userToken)
    localStorage.setItem('ht_token', userToken)
    
    try {
      // On demande au serveur les infos complètes (avec permissions)
      const freshUser = await api.me()
      setUser(freshUser)
      localStorage.setItem('ht_user', JSON.stringify(freshUser))
      return freshUser // On retourne l'utilisateur à jour
    } catch (err) {
      // En cas d'erreur, on garde les données de base du login
      setUser(userData)
      localStorage.setItem('ht_user', JSON.stringify(userData))
      return userData
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('ht_token')
    localStorage.removeItem('ht_user')
  }

  const isAuthenticated = !!token && !!user
  const isAdmin = user?.role === 'admin'

  const hasPermission = (code) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.permissions?.includes(code) || false
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isAdmin, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}