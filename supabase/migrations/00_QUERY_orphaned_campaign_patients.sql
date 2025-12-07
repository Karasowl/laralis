-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO: Pacientes con vía de llegada "Campaña" sin campaña específica
-- ============================================================================
-- Este script NO modifica datos, solo identifica pacientes problemáticos
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Buscar todos los patient_sources que contengan "campaña" o "campaign"
SELECT '=== PATIENT SOURCES RELACIONADOS CON CAMPAÑAS ===' as info;
SELECT id, clinic_id, name, description, is_active
FROM patient_sources
WHERE LOWER(name) LIKE '%campa%'
   OR LOWER(name) LIKE '%campaign%'
   OR LOWER(description) LIKE '%campa%';

-- 2. Pacientes con source "Campaña" pero SIN campaign_id específico
SELECT '=== PACIENTES CON SOURCE CAMPAÑA PERO SIN CAMPAIGN_ID ===' as info;
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.created_at,
  ps.name as source_name,
  p.campaign_id,
  CASE WHEN p.campaign_id IS NULL THEN '⚠️ SIN CAMPAÑA ESPECÍFICA' ELSE '✅ OK' END as status
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id
WHERE (
  LOWER(ps.name) LIKE '%campa%'
  OR LOWER(ps.name) LIKE '%campaign%'
)
AND p.campaign_id IS NULL
ORDER BY p.created_at DESC;

-- 3. Contar cuántos pacientes están afectados por clínica
SELECT '=== RESUMEN POR CLÍNICA ===' as info;
SELECT
  c.name as clinic_name,
  COUNT(*) as pacientes_sin_campaign_id,
  MIN(p.created_at) as primer_paciente,
  MAX(p.created_at) as ultimo_paciente
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id
LEFT JOIN clinics c ON p.clinic_id = c.id
WHERE (
  LOWER(ps.name) LIKE '%campa%'
  OR LOWER(ps.name) LIKE '%campaign%'
)
AND p.campaign_id IS NULL
GROUP BY c.id, c.name
ORDER BY pacientes_sin_campaign_id DESC;

-- 4. Mostrar las campañas disponibles para asignar manualmente
SELECT '=== CAMPAÑAS DISPONIBLES ===' as info;
SELECT
  mc.id,
  mc.name,
  mc.clinic_id,
  c.name as clinic_name,
  mc.is_active,
  mc.created_at
FROM marketing_campaigns mc
LEFT JOIN clinics c ON mc.clinic_id = c.id
ORDER BY mc.clinic_id, mc.name;

-- 5. Pacientes que dicen "Google" pero probablemente son orgánicos mal mapeados
SELECT '=== PACIENTES CON SOURCE "GOOGLE" (posible error de mapeo) ===' as info;
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.created_at,
  ps.name as source_name,
  p.platform_id,
  CASE
    WHEN p.platform_id IS NOT NULL THEN '✅ Tiene plataforma'
    ELSE '⚠️ Sin plataforma (era orgánico?)'
  END as status
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id
WHERE LOWER(ps.name) = 'google'
ORDER BY p.created_at DESC;
