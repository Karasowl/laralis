---
id: TASK-20251206-calendar-improvements
title: Improve Google Calendar Integration (Fixes + UX + Conflict Detection)
status: active
priority: P1
estimate: L (4-5 days)
area: ui, infra, docs
parent: TASK-20251127-google-calendar-integration
links:
  - web/lib/google-calendar.ts
  - web/app/treatments/calendar/page.tsx
  - docs/integrations/GOOGLE-CALENDAR-SETUP.md
  - web/lib/calendar/conflict-detection.ts
---

## Descripcion

Mejorar la integracion existente de Google Calendar que tiene varios bugs criticos (timezone, mapeo de status, errores silenciosos), documentar la configuracion de Google Cloud Console, mejorar la vista de calendario con vistas de semana/dia y agregar deteccion de conflictos de citas.

## Phase 1: Fix Critical Bugs

### 1.1 Fix Timezone Handling
- [x] Agregar timezone a eventos de Google Calendar
- [x] Usar timezone de la clinica (default: America/Mexico_City)

### 1.2 Fix Status Mapping Inconsistency
- [x] Crear constantes para estados sincronizables (SYNCABLE_STATUSES)
- [x] Unificar logica pending/scheduled/in_progress

### 1.3 Fix Silent Errors
- [x] Retornar resultado estructurado de sync (CalendarSyncResult)
- [x] Agregar calendarSync status en API responses
- [x] Mostrar toasts cuando sync falla (integrated in use-treatments.ts)

### 1.4 Fix Hardcoded Weekdays
- [x] Usar i18n para dias de semana en calendario

## Phase 2: Google Cloud Setup Documentation

- [x] Crear docs/integrations/GOOGLE-CALENDAR-SETUP.md
- [x] Paso a paso con instrucciones
- [x] Troubleshooting section
- [ ] Screenshots (manual task)

## Phase 3: Improve Calendar View UI

- [x] Agregar vista de semana
- [x] Agregar vista de dia
- [x] Mejorar colores por status (including in_progress, dark mode support)
- [x] Click en espacio vacio pre-llena fecha/hora
- [x] Refactorizar a componentes separados (page.tsx: 549 -> 282 lines)
- [ ] Tooltips con detalles (future enhancement)

## Phase 4: Conflict Detection

- [x] Crear lib/calendar/conflict-detection.ts
- [x] API endpoint /api/treatments/check-conflicts
- [x] Warning en tiempo real en formulario (debounced, shows conflicts)
- [x] Indicador visual en calendario (all views: month, week, day)

## Phase 5: Calendar Selection UX

- [x] Modificar OAuth callback para no auto-seleccionar calendario primario
- [x] Crear pagina de seleccion de calendario (/settings/calendar/select)
- [x] Crear API endpoint para completar conexion (/api/auth/google-calendar/complete)
- [x] Agregar funciones helper: saveClinicCalendarTokens, completeCalendarConnection, getPendingCalendarConfig
- [x] Usuario puede elegir cualquier calendario de Google (personal, compartido, etc.)
- [x] Traducciones EN/ES para seleccion de calendario

## Phase 6: Polish and Test

- [x] Loading states (calendar loading, conflict checking spinner)
- [x] Success feedback (toasts for sync results)
- [ ] Unit tests para conflict detection
- [ ] Manual testing checklist
- [ ] Devlog entry

## Acceptance Criteria

- [x] npm run dev builds clean
- [x] npm run build succeeds
- [ ] npm run lint sin errores (pending review)
- [ ] npm test green (pending new tests)
- [x] Eventos en Google Calendar con hora correcta (timezone fixed)
- [x] Errores de sync visibles al usuario (toast notifications)
- [x] Vistas month/week/day funcionales
- [x] Conflictos detectados (API + calendar UI + form warning)
- [x] Documentacion de setup completa
- [x] i18n keys en EN y ES
- [x] Archivos <400 lineas (page.tsx refactored)

## Files Modified/Created

### Modified
- `web/lib/google-calendar.ts` - Added timezone, status constants, CalendarSyncResult, calendar selection helpers
- `web/app/api/treatments/route.ts` - Updated to handle CalendarSyncResult
- `web/app/api/treatments/[id]/route.ts` - Updated to handle CalendarSyncResult
- `web/app/api/auth/google-calendar/route.ts` - Updated to support pending connections and list calendars
- `web/app/api/auth/google-calendar/callback/route.ts` - Changed to redirect to selection page
- `web/app/treatments/calendar/page.tsx` - Refactored, now uses components (282 lines)
- `web/app/treatments/components/TreatmentForm.tsx` - Added real-time conflict detection
- `web/app/treatments/page.tsx` - Pass treatmentId to form for conflict exclusion
- `web/hooks/use-treatments.ts` - Added toast notifications for calendar sync
- `web/messages/es.json` - Added calendar, conflict, sync, and selection i18n keys
- `web/messages/en.json` - Added calendar, conflict, sync, and selection i18n keys

### Created
- `docs/integrations/GOOGLE-CALENDAR-SETUP.md` - Complete setup guide
- `web/lib/calendar/conflict-detection.ts` - Conflict detection logic
- `web/app/api/treatments/check-conflicts/route.ts` - Conflict check API
- `web/app/api/auth/google-calendar/complete/route.ts` - Complete calendar connection API
- `web/app/settings/calendar/select/page.tsx` - Calendar selection page
- `web/app/treatments/calendar/components/CalendarTypes.ts` - Shared types and helpers
- `web/app/treatments/calendar/components/MonthView.tsx` - Month view component
- `web/app/treatments/calendar/components/WeekView.tsx` - Week view component
- `web/app/treatments/calendar/components/DayView.tsx` - Day view component
- `web/app/treatments/calendar/components/TodayAppointments.tsx` - Today's appointments
- `web/app/treatments/calendar/components/index.ts` - Component exports

## Next Steps

1. Write unit tests for conflict-detection.ts
2. Run lint and fix any issues
3. Manual testing checklist
4. Create devlog entry
