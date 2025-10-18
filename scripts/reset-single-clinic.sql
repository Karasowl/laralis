-- =====================================================
-- Script: Limpiar datos de una clínica específica
-- Fecha: 2025-10-18
-- Descripción: Elimina datos de una clínica pero mantiene
--              el workspace y otros datos
-- =====================================================

-- ⚠️ INSTRUCCIONES:
-- 1. Reemplaza 'CLINIC_ID_AQUI' con el UUID de la clínica
-- 2. Ejecuta el script completo

-- Configuración
\set clinic_id 'CLINIC_ID_AQUI'

BEGIN;

-- 1. Mostrar información de la clínica a borrar
SELECT '========================================' as separador;
SELECT 'CLÍNICA A LIMPIAR' as titulo;
SELECT '========================================' as separador;

SELECT
    id,
    name,
    workspace_id,
    created_at
FROM clinics
WHERE id = :'clinic_id';

-- 2. Conteo de datos ANTES
SELECT '========================================' as separador;
SELECT 'DATOS ACTUALES DE ESTA CLÍNICA' as titulo;
SELECT '========================================' as separador;

SELECT
    (SELECT COUNT(*) FROM patients WHERE clinic_id = :'clinic_id') as pacientes,
    (SELECT COUNT(*) FROM treatments WHERE clinic_id = :'clinic_id') as tratamientos,
    (SELECT COUNT(*) FROM expenses WHERE clinic_id = :'clinic_id') as gastos,
    (SELECT COUNT(*) FROM marketing_campaigns WHERE clinic_id = :'clinic_id') as campañas,
    (SELECT COUNT(*) FROM services WHERE clinic_id = :'clinic_id') as servicios,
    (SELECT COUNT(*) FROM supplies WHERE clinic_id = :'clinic_id') as insumos;

-- 3. Deshabilitar RLS temporalmente
ALTER TABLE IF EXISTS treatments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_supplies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fixed_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tariffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings_time DISABLE ROW LEVEL SECURITY;

-- 4. Eliminar datos de la clínica
DELETE FROM treatments WHERE clinic_id = :'clinic_id';
DELETE FROM expenses WHERE clinic_id = :'clinic_id';
DELETE FROM patients WHERE clinic_id = :'clinic_id';
DELETE FROM marketing_campaigns WHERE clinic_id = :'clinic_id';
DELETE FROM service_supplies
WHERE service_id IN (SELECT id FROM services WHERE clinic_id = :'clinic_id');
DELETE FROM services WHERE clinic_id = :'clinic_id';
DELETE FROM supplies WHERE clinic_id = :'clinic_id';
DELETE FROM assets WHERE clinic_id = :'clinic_id';
DELETE FROM fixed_costs WHERE clinic_id = :'clinic_id';
DELETE FROM tariffs WHERE clinic_id = :'clinic_id';
DELETE FROM settings_time WHERE clinic_id = :'clinic_id';

-- 5. Re-habilitar RLS
ALTER TABLE IF EXISTS treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings_time ENABLE ROW LEVEL SECURITY;

-- 6. Verificar estado DESPUÉS
SELECT '========================================' as separador;
SELECT 'DATOS DESPUÉS DE LIMPIAR' as titulo;
SELECT '========================================' as separador;

SELECT
    (SELECT COUNT(*) FROM patients WHERE clinic_id = :'clinic_id') as pacientes,
    (SELECT COUNT(*) FROM treatments WHERE clinic_id = :'clinic_id') as tratamientos,
    (SELECT COUNT(*) FROM expenses WHERE clinic_id = :'clinic_id') as gastos,
    (SELECT COUNT(*) FROM marketing_campaigns WHERE clinic_id = :'clinic_id') as campañas,
    (SELECT COUNT(*) FROM services WHERE clinic_id = :'clinic_id') as servicios,
    (SELECT COUNT(*) FROM supplies WHERE clinic_id = :'clinic_id') as insumos;

SELECT '========================================' as separador;
SELECT '✅ CLÍNICA LIMPIADA (estructura mantenida)' as resultado;
SELECT 'La clínica sigue existiendo pero sin datos' as nota;
SELECT '========================================' as separador;

COMMIT;

-- =====================================================
-- PARA ELIMINAR LA CLÍNICA COMPLETAMENTE (opcional):
-- =====================================================
-- Descomentar las siguientes líneas si también quieres
-- borrar la clínica del workspace:
--
-- DELETE FROM clinics WHERE id = :'clinic_id';
--
-- ⚠️ Esto eliminará la clínica y todas sus relaciones
-- =====================================================
