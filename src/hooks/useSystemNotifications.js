import { useEffect, useRef } from 'react'
import { api } from '../api'

export function useSystemNotifications(user) {
  // On stocke la date de la dernière vérification
  const lastCheckRef = useRef(new Date().toISOString())

  useEffect(() => {
    // 1. Demander la permission au navigateur (une seule fois)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // 2. Fonction qui vérifie les notifications
    const checkNotifications = async () => {
      // Si pas d'utilisateur connecté ou permission refusée, on ne fait rien
      if (!user || Notification.permission !== 'granted') return

      try {
        const res = await api.get(`/api/notifications/recent?since=${lastCheckRef.current}`)
        
        if (res && res.notifications && res.notifications.length > 0) {
          res.notifications.forEach(notif => {
            // Création de la notification Windows
            const nativeNotif = new Notification(notif.title, {
              body: notif.message,
              icon: '/favicon.svg', // Assurez-vous que le fichier existe dans public/
              tag: `notif-${notif.id}`, // Évite les doublons
            })

            // Optionnel : Cliquer sur la notification ouvre le ticket
            nativeNotif.onclick = () => {
              window.focus()
              if (notif.ticketId) {
                window.location.href = `/tickets/${notif.ticketId}`
              }
            }
          })
        }
        
        // Mettre à jour la date pour la prochaine vérification
        lastCheckRef.current = new Date().toISOString()
      } catch (err) {
        console.error('Erreur check notifs:', err)
      }
    }

    // Lancer la vérification immédiatement, puis toutes les 30 secondes
    checkNotifications()
    const interval = setInterval(checkNotifications, 30000)

    // Nettoyage quand on quitte la page
    return () => clearInterval(interval)
  }, [user])
}