-- =====================================================
-- ARREGLAR MULTIPLICACIÓN EXTRA EN fixed_costs
-- =====================================================

-- 1. VER EL PROBLEMA
SELECT 'PROBLEMA ACTUAL:' as info;
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as pesos_mostrados,
    amount_cents / 10000.0 as pesos_reales
FROM fixed_costs
WHERE amount_cents > 1000
ORDER BY created_at DESC;

-- 2. CORREGIR - DIVIDIR ENTRE 100 TODOS LOS VALORES
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100;

-- 3. VERIFICAR CORRECCIÓN
SELECT 'DESPUÉS DE CORRECCIÓN:' as info;
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as pesos
FROM fixed_costs
ORDER BY created_at DESC;

-- 4. AGREGAR COLUMNA active A services SI NO EXISTE
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 5. VERIFICAR ESTRUCTURA DE services
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'services'
ORDER BY ordinal_position;