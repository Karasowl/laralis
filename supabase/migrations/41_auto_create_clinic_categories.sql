-- Migration 41: Auto-crear patient_sources y custom_categories al crear clínica
-- Fecha: 2025-10-21
-- Propósito: Asegurar que cada clínica nueva tenga automáticamente las categorías necesarias
--            para el sistema de marketing (fuentes de pacientes, plataformas, etc.)

-- ============================================================================
-- FUNCIÓN: Crear categorías por defecto para una clínica nueva
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_categories_for_clinic()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Patient Sources (Fuentes de adquisición de pacientes)
  -- Estas son específicas por clínica y permiten tracking de origen
  INSERT INTO public.patient_sources (clinic_id, name, description, is_active, is_system)
  VALUES
    (NEW.id, 'direct', 'Llegó directamente sin referencia', true, true),
    (NEW.id, 'referral', 'Referido por otro paciente', true, true),
    (NEW.id, 'social_media', 'Redes sociales (Facebook, Instagram, TikTok)', true, true),
    (NEW.id, 'google', 'Búsqueda en Google / Google Ads', true, true),
    (NEW.id, 'website', 'Sitio web de la clínica', true, true),
    (NEW.id, 'recommendation', 'Recomendación médica externa', true, true),
    (NEW.id, 'other', 'Otro medio no especificado', true, true)
  ON CONFLICT DO NOTHING;

  -- 2. Custom Categories para tratamientos (opcionales)
  -- Estas permiten categorizar servicios según especialidad
  INSERT INTO public.custom_categories (
    clinic_id,
    category_type_id,
    name,
    display_name,
    is_active,
    is_system
  )
  SELECT
    NEW.id,
    ct.id,
    vals.name,
    vals.display_name,
    true,
    true
  FROM (VALUES
    ('preventive', 'Preventivo'),
    ('restorative', 'Restaurativo'),
    ('endodontics', 'Endodoncia')
  ) AS vals(name, display_name)
  CROSS JOIN (
    SELECT id
    FROM public.category_types
    WHERE name = 'service_category' OR code = 'service'
    LIMIT 1
  ) AS ct
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ejecutar función al insertar nueva clínica
-- ============================================================================

-- Eliminar trigger anterior si existe (para idempotencia)
DROP TRIGGER IF EXISTS after_clinic_insert ON public.clinics;

-- Crear trigger que se ejecuta DESPUÉS de insertar
CREATE TRIGGER after_clinic_insert
AFTER INSERT ON public.clinics
FOR EACH ROW
EXECUTE FUNCTION create_default_categories_for_clinic();

-- ============================================================================
-- BACKFILL: Aplicar categorías a clínicas existentes
-- ============================================================================

-- Para clínicas que ya existen en la DB, crear sus categorías
DO $$
DECLARE
  clinic_record RECORD;
BEGIN
  FOR clinic_record IN
    SELECT id FROM public.clinics WHERE is_active = true
  LOOP
    -- Patient Sources
    INSERT INTO public.patient_sources (clinic_id, name, description, is_active, is_system)
    VALUES
      (clinic_record.id, 'direct', 'Llegó directamente sin referencia', true, true),
      (clinic_record.id, 'referral', 'Referido por otro paciente', true, true),
      (clinic_record.id, 'social_media', 'Redes sociales (Facebook, Instagram, TikTok)', true, true),
      (clinic_record.id, 'google', 'Búsqueda en Google / Google Ads', true, true),
      (clinic_record.id, 'website', 'Sitio web de la clínica', true, true),
      (clinic_record.id, 'recommendation', 'Recomendación médica externa', true, true),
      (clinic_record.id, 'other', 'Otro medio no especificado', true, true)
    ON CONFLICT DO NOTHING;

    -- Custom Categories (solo si existe category_type adecuado)
    INSERT INTO public.custom_categories (
      clinic_id,
      category_type_id,
      name,
      display_name,
      is_active,
      is_system
    )
    SELECT
      clinic_record.id,
      ct.id,
      vals.name,
      vals.display_name,
      true,
      true
    FROM (VALUES
      ('preventive', 'Preventivo'),
      ('restorative', 'Restaurativo'),
      ('endodontics', 'Endodoncia')
    ) AS vals(name, display_name)
    CROSS JOIN (
      SELECT id
      FROM public.category_types
      WHERE name = 'service_category' OR code = 'service'
      LIMIT 1
    ) AS ct
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICACIÓN: Mostrar resultados
-- ============================================================================

SELECT
  'Migración 41 completada' as status,
  COUNT(DISTINCT c.id) as total_clinics,
  COUNT(ps.id) as patient_sources_created,
  COUNT(cc.id) as custom_categories_created
FROM public.clinics c
LEFT JOIN public.patient_sources ps ON ps.clinic_id = c.id AND ps.is_system = true
LEFT JOIN public.custom_categories cc ON cc.clinic_id = c.id AND cc.is_system = true
WHERE c.is_active = true;
