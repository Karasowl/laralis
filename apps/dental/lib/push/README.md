# Push Notifications System

Sistema completo de notificaciones push del navegador usando Web Push API y Service Workers.

## Arquitectura

```
┌─────────────────────────────────────────────┐
│  Browser (Client)                           │
│  ├─ Service Worker (/sw.js)                 │
│  ├─ usePushNotifications() hook             │
│  └─ NotificationsClient (UI)                │
└──────────────┬──────────────────────────────┘
               │
               │ HTTPS
               │
┌──────────────▼──────────────────────────────┐
│  API Endpoints                              │
│  ├─ POST /api/notifications/push/subscribe  │
│  ├─ POST /api/notifications/push/unsubscribe│
│  └─ POST /api/notifications/push/track-click│
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Database (Supabase)                        │
│  ├─ push_subscriptions                      │
│  └─ push_notifications (delivery log)       │
└─────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Server Sender                              │
│  ├─ lib/push/service.ts                     │
│  ├─ web-push + VAPID keys                   │
│  └─ Expired subscription cleanup            │
└─────────────────────────────────────────────┘
```

## Estado Actual

### ✅ Implementado

- **Migración SQL** (`65_push_notifications.sql`)
  - Tabla `push_subscriptions`: Almacena endpoints de suscripción
  - Tabla `push_notifications`: Log de envío y tracking
  - RLS policies para multi-tenancy
  - Indexes para performance

- **Service Worker** (`/public/sw.js`)
  - Manejo de eventos `push`
  - Tracking de clicks en notificaciones
  - Apertura de URLs específicas
  - Compatibilidad con múltiples formatos de notificación

- **Client Hook** (`use-push-notifications.ts`)
  - Detección de soporte del navegador
  - Solicitud de permisos
  - Registro de Service Worker
  - Suscripción/desuscripción
  - Sincronización con backend

- **API Endpoints**
  - `POST /api/notifications/push/subscribe`: Guarda suscripciones
  - `POST /api/notifications/push/unsubscribe`: Desactiva suscripciones
  - `POST /api/notifications/push/track-click`: Tracking de interacción

- **UI Integration** (`NotificationsClient.tsx`)
  - Card de Push Notifications en /settings/notifications
  - Estados: not supported, permission request, enabled
  - Botones enable/disable con feedback visual

- **Traducciones** (EN + ES)
  - Todas las claves en `messages/en.json` y `messages/es.json`

- **Server Delivery Service** (`lib/push/service.ts`)
  - `PushNotificationService` con métodos:
    - `sendNotification()`: Envío genérico
    - `sendNotificationToClinic()`: Envío a suscripciones activas de una clínica
    - `sendAppointmentReminder()`: Recordatorios de citas
    - `sendTreatmentCreated()`: Notificación de tratamiento
    - `sendLowStockAlert()`: Alertas de inventario
  - Usa `web-push` con VAPID.
  - Crea registro `pending`, marca `sent` o `failed` y desactiva suscripciones expiradas con 404/410.
  - Las pruebas de proveedor usan adaptador mockeado; no prueban entrega real contra Google/Apple/browser push.

### ⏳ Pendiente

- **Generación/rotación de VAPID keys cuando haga falta**
  ```bash
  npx web-push generate-vapid-keys
  ```

- **Configuración en .env.local / Vercel**
  ```env
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCf...xyz
  VAPID_PRIVATE_KEY=abc...123
  VAPID_SUBJECT=mailto:ops@example.com
  ```

- **Integración de producto**
  - Conectar recordatorios cron, creación de tratamiento y alertas de inventario al sender.
  - Añadir un smoke opcional con proveedor real, ejecutado solo con flag explícito porque depende de navegador/proveedor externo.

## Uso

### 1. Usuario habilita notificaciones

```typescript
// En NotificationsClient.tsx (ya implementado)
const { subscribe } = usePushNotifications()
await subscribe() // Pide permiso y guarda suscripción
```

### 2. Backend envía notificación

```typescript
import { pushNotificationService } from '@/lib/push/service'

// Enviar recordatorio de cita
await pushNotificationService.sendAppointmentReminder(
  userId,
  clinicId,
  {
    patientName: 'Juan Pérez',
    serviceName: 'Limpieza Dental',
    dateTime: '15:00'
  }
)
```

### 3. Service Worker recibe push

```javascript
// En sw.js (ya implementado)
self.addEventListener('push', (event) => {
  const data = event.data.json()
  self.registration.showNotification(data.title, options)
})
```

### 4. Usuario hace click

```javascript
// En sw.js (ya implementado)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  clients.openWindow(data.url)
  // Track click automáticamente
})
```

## Seguridad

- ✅ VAPID keys nunca expuestas al cliente
- ✅ Service Worker en scope raíz (/)
- ✅ RLS policies en todas las tablas
- ✅ Multi-tenancy verificado en subscribe/unsubscribe
- ✅ Validation de permisos en todos los endpoints

## Testing

### Test Manual

1. Ir a `/settings/notifications`
2. Click en "Activar Notificaciones Push"
3. Permitir notificaciones en el browser
4. Verificar en DevTools > Application > Service Workers que sw.js está registrado
5. Verificar en DevTools > Application > Storage > IndexedDB que hay suscripción
6. Verificar en Supabase que existe registro en `push_subscriptions`

### Test de Envío

```typescript
// En algún endpoint o script
import { pushNotificationService } from '@/lib/push/service'

await pushNotificationService.sendNotification({
  userId: 'user-uuid',
  clinicId: 'clinic-uuid',
  notificationType: 'test',
  payload: {
    title: 'Test Notification',
    body: 'This is a test',
    url: '/dashboard'
  }
})
```

### Provider-contract test

```bash
npm --workspace @laralis/dental run qa:provider-contracts
```

Ese test valida VAPID, payload de service worker, estados `sent/failed`, y limpieza de suscripciones expiradas sin hacer llamadas reales a proveedores externos.

## Troubleshooting

### "Service Worker not found"
→ Verificar que `/public/sw.js` existe
→ Verificar que estás en HTTPS (o localhost)

### "Push subscription failed"
→ Verificar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en .env.local
→ Verificar permisos del navegador

### "Notification not delivered"
→ Verificar VAPID_PRIVATE_KEY en .env.local
→ Verificar NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PUBLIC_KEY
→ Check logs en `push_notifications` table
→ Si el proveedor devuelve 404/410, la suscripción se desactiva automáticamente

### "RLS policy violation"
→ Verificar que usuario tiene membresía en la clínica
→ Verificar que `resolveClinicContext` se ejecuta en el endpoint

## Roadmap

### Phase 1: Infrastructure (✅ COMPLETE)
- [x] Database schema
- [x] Service Worker
- [x] Client hook
- [x] API endpoints
- [x] UI integration
- [x] Translations

### Phase 2: Delivery (✅ CONTRACT COVERED)
- [x] Install web-push
- [x] Configure VAPID support
- [x] Implement server-side push delivery
- [x] Error handling for expired subscriptions
- [x] Provider-contract tests with mocked adapter
- [ ] Optional live-provider smoke gated by explicit env flags

### Phase 3: Integration (Future)
- [ ] Auto-send appointment reminders (cron job)
- [ ] Auto-send treatment confirmations (on create)
- [ ] Auto-send low stock alerts (trigger-based)
- [ ] User preferences (disable specific notification types)

### Phase 4: Analytics (Future)
- [ ] Delivery rate dashboard
- [ ] Click-through rate metrics
- [ ] Best time to send analysis

## Referencias

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push library](https://github.com/web-push-libs/web-push)
- [VAPID keys](https://datatracker.ietf.org/doc/html/rfc8292)

---

**Autor**: Claude Code
**Fecha**: 2025-12-14
**Status**: Phase 1 Complete, Phase 2 Contract Covered
