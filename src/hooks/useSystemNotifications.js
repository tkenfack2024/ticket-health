import { useEffect, useRef } from 'react'
import { api } from '../api'

export function useSystemNotifications(user) {
  const lastCheckRef = useRef(new Date().toISOString())

  useEffect(() => {
    if (!user) return
    if (!('Notification' in window)) return

    const checkNotifications = async () => {
      // ✅ NOUVEAU : On vérifie si l'utilisateur a activé le système
      const isEnabled = localStorage.getItem('ht_notifications_enabled') === 'true'
      if (!isEnabled || Notification.permission !== 'granted') return

      try {
        const res = await api.get(`/api/notifications/list?since=${lastCheckRef.current}`)
        
        if (res && res.notifications && res.notifications.length > 0) {
          res.notifications.forEach(notif => {
            const nativeNotif = new Notification(notif.title, {
              body: notif.message,
              icon: '/favicon.svg',
              tag: `notif-${notif.id}`,
            })

            nativeNotif.onclick = async () => {
              window.focus()
              try { await api.patch(`/api/notifications/${notif.id}/read`, {}) } catch (e) {}
              if (notif.link) window.location.href = notif.link
              nativeNotif.close()
            }
          })

          try { await api.patch('/api/notifications/read-all', {}) } catch (e) {}
        }
        
        lastCheckRef.current = new Date().toISOString()
      } catch (err) {
        console.error('Erreur check notifs:', err)
      }
    }

    checkNotifications()
    const interval = setInterval(checkNotifications, 30000)

    return () => clearInterval(interval)
  }, [user])
}