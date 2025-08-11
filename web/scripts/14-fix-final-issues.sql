-- =====================================================
-- ARREGLAR PROBLEMAS FINALES
-- =====================================================

-- 1. ARREGLAR fixed_costs - Los montos están mal multiplicados
-- ---------------------------------------------
SELECT 'ARREGLANDO fixed_costs...' as status;

-- Ver estado actual
SELECT 
    concept,
    amount_cents as cents_actual,
    amount_cents / 100.0 as pesos_actual,
    CASE 
        WHEN amount_cents > 1000000 THEN amount_cents / 10000
        WHEN amount_cents > 100000 THEN amount_cents / 100
        ELSE amount_cents
    END as cents_corregido,
    CASE 
        WHEN amount_cents > 1000000 THEN (amount_cents / 10000) / 100.0
        WHEN amount_cents > 100000 THEN (amount_cents / 100) / 100.0
        ELSE amount_cents / 100.0
    END as pesos_corregido
FROM fixed_costs
ORDER BY created_at DESC;

-- Aplicar corrección
UPDATE fixed_costs 
SET amount_cents = 
    CASE 
        WHEN amount_cents > 1000000 THEN amount_cents / 10000
        WHEN amount_cents > 100000 THEN amount_cents / 100
        ELSE amount_cents
    END
WHERE amount_cents > 10000; -- Solo corregir si es mayor a 100 pesos

-- 2. VERIFICAR PERMISOS EN patients
-- ---------------------------------------------
SELECT 'VERIFICANDO PERMISOS patients...' as status;

-- Dar todos los permisos necesarios
GRANT ALL ON patients TO authenticated;
GRANT ALL ON patients TO anon;
GRANT ALL ON patients TO service_role;

-- 3. ARREGLAR service_supplies - No tiene clinic_id
-- ---------------------------------------------
SELECT 'ARREGLANDO service_supplies...' as status;

-- La tabla service_supplies no necesita clinic_id porque el service_id ya está relacionado con una clínica
-- Pero necesitamos arreglar el query que está buscando por clinic_id

-- Verificar estructura actual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_supplies'
ORDER BY ordinal_position;

-- 4. VERIFICAR Y CREAR ÍNDICES FALTANTES
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS idx_service_supplies_service ON service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_supplies_supply ON service_supplies(supply_id);

-- 5. VERIFICACIÓN FINAL
-- ---------------------------------------------
SELECT '=== VERIFICACIÓN FINAL ===' as status;

-- Ver fixed_costs corregidos
SELECT 
    'Fixed costs después de corrección:' as info;

SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
WHERE amount_cents IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Verificar permisos de patients
SELECT 
    'Permisos de patients:' as info;

SELECT 
    grantee,
    string_agg(privilege_type, ', ') as permisos
FROM information_schema.role_table_grants 
WHERE table_name = 'patients'
GROUP BY grantee;

-- Verificar service_supplies
SELECT 
    'Estructura de service_supplies:' as info;

SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'service_supplies'
ORDER BY ordinal_position;

SELECT '✅ Script ejecutado' as mensaje;