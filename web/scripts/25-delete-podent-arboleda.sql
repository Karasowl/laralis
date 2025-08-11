-- =====================================================
-- ELIMINAR CLÍNICA FANTASMA "PODENT ARBOLEDA"
-- Esta clínica aparece para todos los usuarios y debe eliminarse
-- =====================================================

-- 1. Primero, verificar si existe la clínica
SELECT 
    id,
    name,
    workspace_id,
    created_at
FROM clinics
WHERE LOWER(name) LIKE '%podent%' 
   OR LOWER(name) LIKE '%arboleda%';

-- 2. Si existe, eliminar todos los datos relacionados primero
-- Esto eliminará en cascada todos los datos asociados

-- Eliminar tratamientos
DELETE FROM treatments 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar pacientes
DELETE FROM patients 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar service_supplies
DELETE FROM service_supplies 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar servicios
DELETE FROM services 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar insumos
DELETE FROM supplies 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar costos fijos
DELETE FROM fixed_costs 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar activos
DELETE FROM assets 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- Eliminar configuración de tiempo
DELETE FROM settings_time 
WHERE clinic_id IN (
    SELECT id FROM clinics 
    WHERE LOWER(name) LIKE '%podent%arboleda%'
);

-- 3. Finalmente, eliminar la clínica fantasma
DELETE FROM clinics 
WHERE LOWER(name) LIKE '%podent%arboleda%';

-- 4. Verificar que se eliminó
SELECT 
    'Clínicas restantes con nombre similar:' as mensaje,
    COUNT(*) as cantidad
FROM clinics
WHERE LOWER(name) LIKE '%podent%' 
   OR LOWER(name) LIKE '%arboleda%';

-- 5. Mostrar todas las clínicas actuales
SELECT 
    id,
    name,
    workspace_id,
    created_at
FROM clinics
ORDER BY created_at DESC;