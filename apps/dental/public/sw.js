// Service Worker for Push Notifications
// Version: 1.0.0

const CACHE_NAME = 'laralis-v1';
const NOTIFICATION_ICON = '/icons/icon-192x192.png';
const NOTIFICATION_BADGE = '/icons/badge-72x72.png';

// Install event - can be used for caching if needed
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  const options = {
    body: data.body || 'Nueva notificación',
    icon: data.icon || NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
      dateOfArrival: Date.now()
    },
    actions: data.actions || []
  };

  // Add image if provided
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Laralis', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  const notificationId = event.notification.data?.notificationId;

  // Track click event (send to backend)
  if (notificationId) {
    fetch('/api/notifications/push/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId })
    }).catch(err => console.error('[SW] Failed to track click:', err));
  }

  // Open or focus existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // No matching window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event);
});

// Background sync event (for future use)
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync:', event.tag);
  // Can be used for offline data sync
});

// Message event - communication from client pages
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
