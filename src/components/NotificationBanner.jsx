// src/components/NotificationBanner.jsx
import { useState, useEffect, useRef } from 'react'
import { X, Megaphone, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

// Icônes par variante
const VARIANT_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  danger: AlertTriangle,
  fluo: Zap,
}

// Délai de polling (60s)
const POLL_INTERVAL = 60000

// Nombre max de bannières affichées en même temps
const MAX_VISIBLE = 3

export default function NotificationBanner() {
  const { hasPermission, isAuthenticated } = useAuth()
  const [banners, setBanners] = useState([])
  const dismissedRef = useRef(new Set())

  // Vérifie si une bannière a déjà été vue (par id + updated_at)
  const getDismissKey = (banner) => `${banner.id}:${banner.updated_at || banner.created_at || ''}`

  const loadBanners = async () => {
    if (!isAuthenticated) return
    if (!hasPermission('notifications.banner.read')) return

    try {
      const data = await api.getActiveBanners()
      if (!Array.isArray(data)) return

      // Filtre : ne garde que les bannières non fermées manuellement
      const fresh = data.filter(b => !dismissedRef.current.has(getDismissKey(b)))

      // Trie par id DESC (les plus récentes d'abord), limite à MAX_VISIBLE
      const sorted = fresh.sort((a, b) => b.id - a.id).slice(0, MAX_VISIBLE)
      setBanners(sorted)
    } catch (err) {
      // Silencieux : pas de bannière = pas de bruit dans la console
      if (err.message && !err.message.includes('Permission')) {
        console.warn('NotificationBanner : erreur chargement', err.message)
      }
    }
  }

  useEffect(() => {
    loadBanners()

    // Polling toutes les 60s
    const interval = setInterval(loadBanners, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Ferme une bannière manuellement (pour cette session)
  const handleDismiss = (banner) => {
    dismissedRef.current.add(getDismissKey(banner))
    setBanners(prev => prev.filter(b => b.id !== banner.id))
  }

  // Disparition auto après duration_seconds
  useEffect(() => {
    if (banners.length === 0) return

    const timers = banners.map(banner => {
      const seconds = parseInt(banner.duration_seconds) || 10
      if (seconds <= 0) return null // 0 = reste jusqu'à fermeture manuelle
      return setTimeout(() => handleDismiss(banner), seconds * 1000)
    }).filter(Boolean)

    return () => timers.forEach(t => clearTimeout(t))
  }, [banners])

  // Rien à afficher
  if (!isAuthenticated) return null
  if (!hasPermission('notifications.banner.read')) return null
  if (banners.length === 0) return null

  return (
    <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 space-y-2 pointer-events-none">
      {banners.map(banner => {
        const Icon = VARIANT_ICONS[banner.variant] || Megaphone
        const variantClass = `banner-variant-${banner.variant || 'info'}`

        return (
          <div
            key={`${banner.id}-${banner.updated_at || ''}`}
            className={`${variantClass} banner-glow rounded-xl px-4 py-3 backdrop-blur-md pointer-events-auto flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2`}
            role="alert"
          >
            <div className="flex-shrink-0 mt-0.5">
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">
                {banner.title}
              </p>
              {banner.message && (
                <p className="text-xs mt-0.5 opacity-90 whitespace-pre-line break-words">
                  {banner.message}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDismiss(banner)}
              className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Fermer"
              aria-label="Fermer la bannière"
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}