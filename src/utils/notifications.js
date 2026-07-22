export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

export function sendLocalNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    // Android vibration pattern
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100])
    }

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: '/pwa-192.png',
          badge: '/pwa-192.png',
          tag: 'chupa-message',
          renotify: true,
          vibrate: [100, 50, 100],
        })
      })
    } else {
      new Notification(title, {
        body,
        icon: '/pwa-192.png',
      })
    }
  } catch (err) {
    console.warn('Notification error:', err)
  }
}
