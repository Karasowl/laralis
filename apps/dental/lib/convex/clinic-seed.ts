/**
 * Convex port of the AFTER INSERT ON clinics seed triggers:
 *   - create_default_categories_for_clinic() (migration 41): 7 patient_sources
 *     + 3 custom_categories (conditional on a service category_type existing).
 *   - create_default_whatsapp_templates() (migration 63): 10 whatsapp_templates
 *     (5 types x es/en).
 *
 * In Supabase mode these run inside Postgres on clinic INSERT. The runtime mirror
 * only mirrors explicit app `.insert()` calls, NOT trigger-generated rows, so in
 * dual/convex write mode these seeded rows would be missing from Convex. This
 * helper reproduces them. It is IDEMPOTENT (Convex has no unique constraints, so
 * we dedupe in JS before inserting) and best-effort (a seed failure logs a warning
 * but never fails clinic creation, matching the spirit of ON CONFLICT DO NOTHING).
 *
 * Names/content are taken VERBATIM from the SQL (the loose lists in
 * AI-KNOWLEDGE-GAPS.md are out of date — trust the migrations).
 */
import {
  upsertConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexTable,
} from './server'

type AnyRow = Record<string, any>

const PATIENT_SOURCES: Array<{ name: string; description: string }> = [
  { name: 'direct', description: 'Llegó directamente sin referencia' },
  { name: 'referral', description: 'Referido por otro paciente' },
  { name: 'social_media', description: 'Redes sociales (Facebook, Instagram, TikTok)' },
  { name: 'google', description: 'Búsqueda en Google / Google Ads' },
  { name: 'website', description: 'Sitio web de la clínica' },
  { name: 'recommendation', description: 'Recomendación médica externa' },
  { name: 'other', description: 'Otro medio no especificado' },
]

const CUSTOM_CATEGORIES: Array<{ name: string; display_name: string }> = [
  { name: 'preventive', display_name: 'Preventivo' },
  { name: 'restorative', display_name: 'Restaurativo' },
  { name: 'endodontics', display_name: 'Endodoncia' },
]

const WHATSAPP_TEMPLATES: Array<{
  name: string
  template_type: string
  content: string
  language: string
}> = [
  // Spanish
  {
    name: 'Confirmación de Cita',
    template_type: 'appointment_confirmation',
    language: 'es',
    content:
      'Hola {{patient_name}}, tu cita en {{clinic_name}} ha sido confirmada para el {{date}} a las {{time}}. Servicio: {{service_name}}. Te esperamos!',
  },
  {
    name: 'Recordatorio de Cita',
    template_type: 'appointment_reminder',
    language: 'es',
    content:
      'Hola {{patient_name}}, te recordamos que tienes una cita {{time_until}} en {{clinic_name}}. Fecha: {{date}} a las {{time}}. Te esperamos!',
  },
  {
    name: 'Cita Cancelada',
    template_type: 'appointment_cancelled',
    language: 'es',
    content:
      'Hola {{patient_name}}, lamentamos informarte que tu cita del {{date}} a las {{time}} en {{clinic_name}} ha sido cancelada. Contáctanos para reagendar.',
  },
  {
    name: 'Solicitud Recibida',
    template_type: 'booking_received',
    language: 'es',
    content:
      'Hola {{patient_name}}, hemos recibido tu solicitud de cita en {{clinic_name}} para el {{date}} a las {{time}}. Te confirmaremos pronto.',
  },
  {
    name: 'Reserva Confirmada',
    template_type: 'booking_confirmed',
    language: 'es',
    content:
      'Hola {{patient_name}}, tu solicitud de cita en {{clinic_name}} ha sido confirmada! Te esperamos el {{date}} a las {{time}}.',
  },
  // English
  {
    name: 'Appointment Confirmation',
    template_type: 'appointment_confirmation',
    language: 'en',
    content:
      'Hi {{patient_name}}, your appointment at {{clinic_name}} has been confirmed for {{date}} at {{time}}. Service: {{service_name}}. See you there!',
  },
  {
    name: 'Appointment Reminder',
    template_type: 'appointment_reminder',
    language: 'en',
    content:
      'Hi {{patient_name}}, this is a reminder that you have an appointment {{time_until}} at {{clinic_name}}. Date: {{date}} at {{time}}. See you there!',
  },
  {
    name: 'Appointment Cancelled',
    template_type: 'appointment_cancelled',
    language: 'en',
    content:
      'Hi {{patient_name}}, we regret to inform you that your appointment on {{date}} at {{time}} at {{clinic_name}} has been cancelled. Contact us to reschedule.',
  },
  {
    name: 'Booking Received',
    template_type: 'booking_received',
    language: 'en',
    content:
      'Hi {{patient_name}}, we have received your appointment request at {{clinic_name}} for {{date}} at {{time}}. We will confirm shortly.',
  },
  {
    name: 'Booking Confirmed',
    template_type: 'booking_confirmed',
    language: 'en',
    content:
      'Hi {{patient_name}}, your appointment request at {{clinic_name}} has been confirmed! See you on {{date}} at {{time}}.',
  },
]

async function seedPatientSources(clinicId: string, now: string): Promise<void> {
  const existing = (await listConvexDocumentsByClinic('patient_sources', clinicId)) as AnyRow[]
  const existingNames = new Set((existing || []).map((r) => String(r?.name)))

  for (const source of PATIENT_SOURCES) {
    if (existingNames.has(source.name)) continue
    const id = crypto.randomUUID()
    await upsertConvexDocumentByLegacyId('patient_sources', id, {
      id,
      clinic_id: clinicId,
      name: source.name,
      description: source.description,
      is_active: true,
      is_system: true,
      created_at: now,
      updated_at: now,
    })
  }
}

async function seedCustomCategories(clinicId: string, now: string): Promise<void> {
  // category_types has NO clinic_id (global catalog) -> must use listConvexTable.
  const categoryTypes = (await listConvexTable('category_types', 1000)) as AnyRow[]
  // The real category_types row is named 'service' (migration 29 schema + every
  // onboarding script looks up `name = 'service'`). Migration 41's trigger condition
  // (`name = 'service_category' OR code = 'service'`) is stale — 'service_category'
  // never matches and the `code` column does not exist — so Supabase actually seeds
  // ZERO custom_categories. Match the real name here so the 3 default service
  // categories actually seed in convex-only mode (keeping the legacy literals as a
  // fallback for any deployment that uses them).
  const serviceType = (categoryTypes || []).find(
    (ct) => ct?.name === 'service' || ct?.name === 'service_category' || ct?.code === 'service'
  )
  // No service category_type at all -> seed nothing (don't fabricate an id).
  if (!serviceType) return
  const categoryTypeId = serviceType.id ?? serviceType.legacyId

  const existing = (await listConvexDocumentsByClinic('custom_categories', clinicId)) as AnyRow[]
  const existingKeys = new Set(
    (existing || []).map((r) => `${String(r?.category_type_id)}::${String(r?.name)}`)
  )

  for (const cat of CUSTOM_CATEGORIES) {
    const key = `${String(categoryTypeId)}::${cat.name}`
    if (existingKeys.has(key)) continue
    const id = crypto.randomUUID()
    await upsertConvexDocumentByLegacyId('custom_categories', id, {
      id,
      clinic_id: clinicId,
      category_type_id: categoryTypeId,
      name: cat.name,
      display_name: cat.display_name,
      is_active: true,
      is_system: true,
      created_at: now,
      updated_at: now,
    })
  }
}

async function seedWhatsAppTemplates(clinicId: string, now: string): Promise<void> {
  const existing = (await listConvexDocumentsByClinic('whatsapp_templates', clinicId)) as AnyRow[]
  const existingKeys = new Set(
    (existing || []).map((r) => `${String(r?.template_type)}::${String(r?.language)}`)
  )

  for (const tpl of WHATSAPP_TEMPLATES) {
    const key = `${tpl.template_type}::${tpl.language}`
    if (existingKeys.has(key)) continue
    const id = crypto.randomUUID()
    await upsertConvexDocumentByLegacyId('whatsapp_templates', id, {
      id,
      clinic_id: clinicId,
      name: tpl.name,
      template_type: tpl.template_type,
      content: tpl.content,
      language: tpl.language,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
  }
}

/**
 * Seed the default patient_sources / custom_categories / whatsapp_templates for a
 * newly-created clinic into Convex. Idempotent and best-effort: only call this
 * behind shouldWriteConvexData('clinics'); a failure logs and returns without
 * throwing so it never blocks clinic creation.
 */
export async function seedClinicDefaultsInConvex(clinicId: string): Promise<void> {
  const now = new Date().toISOString()
  try {
    await seedPatientSources(clinicId, now)
  } catch (error) {
    console.warn('[clinic-seed] patient_sources seed failed', { clinicId, error })
  }
  try {
    await seedCustomCategories(clinicId, now)
  } catch (error) {
    console.warn('[clinic-seed] custom_categories seed failed', { clinicId, error })
  }
  try {
    await seedWhatsAppTemplates(clinicId, now)
  } catch (error) {
    console.warn('[clinic-seed] whatsapp_templates seed failed', { clinicId, error })
  }
}
