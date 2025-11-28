# TASK-20251127-google-calendar-integration

## Metadata
- **id**: TASK-20251127-google-calendar-integration
- **title**: Integrar Google Calendar con tratamientos pendientes
- **status**: active
- **priority**: P2
- **estimate**: L (3-4 days)
- **area**: feature, integration, ui

## Summary

Integrar Google Calendar para sincronizar citas (tratamientos pendientes) desde la aplicación hacia Google Calendar, con vista de calendario y ordenamiento por fecha/hora.

## User Requirements

1. **Configuración**: Asociar un calendario de Google desde settings
2. **Sincronización unidireccional (App → Google)**: Al crear/editar tratamiento pendiente, crear evento en Google Calendar
3. **Información del evento**: Básica (nombre paciente + servicio, sin datos sensibles)
4. **Un solo calendario por clínica** (no por dentista)
5. **Vista de calendario**: Ver tratamientos pendientes en formato calendario
6. **Ordenamiento**: Poder ordenar tabla de tratamientos por fecha/hora de cita

## Technical Analysis

### Current State
- ✅ `treatment_time` field exists in DB schema (TIME type)
- ✅ `treatment_date` field exists in DB schema (DATE type)
- ✅ `status` field supports 'pending'/'scheduled'
- ❌ `treatment_time` NOT in UI form (needs to be added)
- ❌ No Google OAuth integration exists
- ❌ No calendar view component exists

### Architecture Decision

**Google Calendar API approach**: OAuth 2.0 with refresh tokens stored in database.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Settings Page                                                   │
│  ┌─────────────────┐                                            │
│  │ Connect Google  │ ──OAuth2──> Google Auth                    │
│  │ Calendar        │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ clinic_google_  │  Stores: access_token, refresh_token,      │
│  │ calendar_tokens │  calendar_id, expires_at                   │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  Treatment Form                                                  │
│  ┌─────────────────┐                                            │
│  │ + treatment_time│                                            │
│  │   field (TIME)  │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼ (on save with status=pending)                       │
│  ┌─────────────────┐                                            │
│  │ API: Create/    │ ──────────> Google Calendar API            │
│  │ Update Event    │              (create event)                │
│  └─────────────────┘                                            │
│                                                                  │
│  Calendar View                                                   │
│  ┌─────────────────┐                                            │
│  │ Full Calendar   │  Shows local treatments with date/time     │
│  │ Component       │  Click → open treatment modal              │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation (Day 1)

#### 1.1 Database Migration
Create table for storing OAuth tokens per clinic:

```sql
CREATE TABLE clinic_google_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,           -- Google Calendar ID
  access_token text NOT NULL,          -- Encrypted
  refresh_token text NOT NULL,         -- Encrypted
  token_expires_at timestamptz NOT NULL,
  connected_email text,                -- Email associated
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id)
);

-- RLS policies
ALTER TABLE clinic_google_calendar ENABLE ROW LEVEL SECURITY;
```

**Files to create/modify:**
- `supabase/migrations/XXXXXX_create_clinic_google_calendar.sql`
- Update `docs/database/SCHEMA-CURRENT.md`

#### 1.2 Add treatment_time to Treatment Form
- Add time input field after date field
- Update API to handle treatment_time
- Add i18n keys

**Files to modify:**
- `web/app/treatments/components/TreatmentForm.tsx`
- `web/app/api/treatments/route.ts`
- `messages/en.json`, `messages/es.json`

### Phase 2: Google OAuth (Day 2)

#### 2.1 Google Cloud Project Setup (Manual)
User needs to:
1. Create Google Cloud Project
2. Enable Google Calendar API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Add redirect URI: `{APP_URL}/api/auth/google-calendar/callback`

#### 2.2 OAuth Implementation
- Create OAuth flow endpoints
- Store tokens securely
- Handle token refresh

**Files to create:**
- `web/app/api/auth/google-calendar/route.ts` (initiate OAuth)
- `web/app/api/auth/google-calendar/callback/route.ts` (handle callback)
- `web/lib/google-calendar.ts` (client helpers)

#### 2.3 Settings Page for Calendar
- Show connection status
- Connect/Disconnect button
- Select which calendar to use

**Files to create:**
- `web/app/settings/calendar/page.tsx`
- `web/app/settings/calendar/components/GoogleCalendarConnect.tsx`

### Phase 3: Sync to Google Calendar (Day 3)

#### 3.1 Event Sync Logic
When treatment with `status=pending` is created/updated:
1. Check if clinic has Google Calendar connected
2. Create/update event in Google Calendar
3. Store `google_event_id` in treatment

**Add field to treatments:**
```sql
ALTER TABLE treatments ADD COLUMN google_event_id text;
```

**Event format:**
```typescript
{
  summary: `${patientName} - ${serviceName}`,
  start: { dateTime: `${treatment_date}T${treatment_time}` },
  end: { dateTime: `${treatment_date}T${treatment_time + duration}` },
  description: `Cita dental - ${serviceName}`
}
```

**Files to create/modify:**
- `web/lib/google-calendar.ts` (add createEvent, updateEvent, deleteEvent)
- `web/app/api/treatments/route.ts` (call sync after save)
- `web/app/api/treatments/[id]/route.ts` (sync on update/delete)

### Phase 4: Calendar View (Day 4)

#### 4.1 Calendar Component
Use `@fullcalendar/react` for calendar view:
- Month/Week/Day views
- Click event to open treatment modal
- Color by status (pending=yellow, completed=green, cancelled=grey)

**Files to create:**
- `web/app/treatments/calendar/page.tsx`
- `web/app/treatments/calendar/components/TreatmentCalendar.tsx`

#### 4.2 Update Treatments Table
- Add `treatment_time` column
- Enable sorting by date + time
- Add calendar view toggle/link

**Files to modify:**
- `web/app/treatments/page.tsx`

### Phase 5: Polish & i18n (Day 4 continued)

- All strings through next-intl
- Error handling for Google API failures
- Loading states
- Success/error toasts

## Files Summary

### New Files
1. `supabase/migrations/XXXXXX_create_clinic_google_calendar.sql`
2. `supabase/migrations/XXXXXX_add_google_event_id_to_treatments.sql`
3. `web/lib/google-calendar.ts`
4. `web/app/api/auth/google-calendar/route.ts`
5. `web/app/api/auth/google-calendar/callback/route.ts`
6. `web/app/settings/calendar/page.tsx`
7. `web/app/settings/calendar/components/GoogleCalendarConnect.tsx`
8. `web/app/treatments/calendar/page.tsx`
9. `web/app/treatments/calendar/components/TreatmentCalendar.tsx`

### Modified Files
1. `web/app/treatments/components/TreatmentForm.tsx` - Add time field
2. `web/app/api/treatments/route.ts` - Handle time, sync to Google
3. `web/app/api/treatments/[id]/route.ts` - Sync updates/deletes
4. `web/app/treatments/page.tsx` - Add time column, calendar link
5. `web/app/settings/page.tsx` - Add calendar settings card
6. `messages/en.json` - i18n keys
7. `messages/es.json` - i18n keys
8. `docs/database/SCHEMA-CURRENT.md` - Schema updates

## Environment Variables Required

```env
# Google OAuth (user provides from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google-calendar/callback
```

## Dependencies to Add

```json
{
  "googleapis": "^140.0.0",
  "@fullcalendar/react": "^6.1.11",
  "@fullcalendar/daygrid": "^6.1.11",
  "@fullcalendar/timegrid": "^6.1.11",
  "@fullcalendar/interaction": "^6.1.11"
}
```

## Acceptance Criteria

1. [ ] `npm run dev` builds clean
2. [ ] `npm test` green
3. [ ] New strings through next-intl en/es
4. [ ] Money only in cents (N/A for this feature)
5. [ ] No new deps without approval → googleapis, @fullcalendar/*
6. [ ] Visuals follow tokens (Apple-like design)
7. [ ] Multi-tenant: clinic-scoped calendar tokens

### Feature-specific
8. [ ] Can connect Google Calendar from settings
9. [ ] Creating pending treatment creates Google Calendar event
10. [ ] Updating treatment updates Google Calendar event
11. [ ] Deleting/cancelling treatment removes/updates Google Calendar event
12. [ ] Calendar view shows all treatments with date/time
13. [ ] Table can be sorted by date/time
14. [ ] OAuth token refresh works automatically

## Security Considerations

- Tokens stored encrypted in database
- Tokens only accessible by clinic owner
- No sensitive patient data in event (just name + service)
- HTTPS required for OAuth callback
- Refresh tokens stored securely

## Rollback Plan

1. Remove migration (drop table)
2. Revert treatment form changes
3. Remove Google Calendar settings page
4. Remove calendar view page

## Follow-up Tasks (Future)

- TASK-FUTURE-multi-dentist-calendars: Support multiple calendars per dentist
- TASK-FUTURE-bidirectional-sync: Read events from Google to show busy slots
- TASK-FUTURE-availability-slots: Define available time slots per day
- TASK-FUTURE-appointment-reminders: Send reminders before appointments
