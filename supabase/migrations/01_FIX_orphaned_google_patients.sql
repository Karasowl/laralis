-- ============================================================================
-- SCRIPT DE CORRECCIÓN: Pacientes con source "Google" incorrecto
-- ============================================================================
-- Este script:
-- 1. Elimina los 10 pacientes de prueba (Paciente Google-1 a Google-10)
-- 2. Cambia el source de los 13 pacientes reales de "google" a "directo"
-- ============================================================================
-- IMPORTANTE: Ejecutar en Supabase SQL Editor
-- ============================================================================

-- PASO 1: Obtener el ID del source "Directo" para cada clínica
-- ============================================================================

-- Primero verificamos qué sources "directos" existen
SELECT '=== VERIFICANDO SOURCES DIRECTOS DISPONIBLES ===' as info;
SELECT id, clinic_id, name
FROM patient_sources
WHERE LOWER(name) IN ('direct', 'directo', 'walk-in', 'sin referencia')
ORDER BY clinic_id;

-- PASO 2: Eliminar pacientes de prueba (Google-1 a Google-10)
-- ============================================================================
SELECT '=== ELIMINANDO PACIENTES DE PRUEBA ===' as info;

-- Primero verificar cuáles se van a eliminar
SELECT id, first_name, last_name, clinic_id
FROM patients
WHERE first_name = 'Paciente'
  AND last_name LIKE 'Google-%';

-- Eliminar los pacientes de prueba
DELETE FROM patients
WHERE first_name = 'Paciente'
  AND last_name LIKE 'Google-%';

-- PASO 3: Actualizar los 13 pacientes reales a source "Directo"
-- ============================================================================
SELECT '=== ACTUALIZANDO PACIENTES REALES ===' as info;

-- Estrategia: Para cada clínica, buscar el source "Walk-in" o "Direct" y asignarlo
-- Si no existe, creamos uno llamado "Direct"

-- Primero, asegurémonos de que cada clínica tenga un source "Walk-in" o similar
-- (Ya debería existir por el trigger de creación de clínica)

-- Actualizar pacientes con source "Google" a "Walk-in" (que es el source por defecto para directos)
UPDATE patients p
SET source_id = (
  SELECT ps.id
  FROM patient_sources ps
  WHERE ps.clinic_id = p.clinic_id
    AND LOWER(ps.name) = 'walk-in'
  LIMIT 1
)
WHERE p.source_id IN (
  SELECT ps.id
  FROM patient_sources ps
  WHERE LOWER(ps.name) = 'google'
)
AND EXISTS (
  SELECT 1
  FROM patient_sources ps
  WHERE ps.clinic_id = p.clinic_id
    AND LOWER(ps.name) = 'walk-in'
);

-- Verificar el resultado
SELECT '=== RESULTADO FINAL ===' as info;

-- Pacientes que aún tienen source "Google" (deberían ser 0)
SELECT COUNT(*) as pacientes_aun_con_google
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id
WHERE LOWER(ps.name) = 'google';

-- Pacientes de prueba restantes (deberían ser 0)
SELECT COUNT(*) as pacientes_prueba_restantes
FROM patients
WHERE first_name = 'Paciente'
  AND last_name LIKE 'Google-%';

SELECT '=== SCRIPT COMPLETADO ===' as info;
