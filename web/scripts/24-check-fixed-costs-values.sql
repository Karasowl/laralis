-- =====================================================
-- VERIFICAR VALORES DE COSTOS FIJOS
-- Para diagnosticar el problema de conversión de pesos
-- =====================================================

-- 1. Ver todos los costos fijos con sus valores en centavos y en pesos
SELECT 
    id,
    category,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    created_at
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 10;

-- 2. Si tienes un costo de "prueba 3" con 20 pesos, debería aparecer como:
-- amount_cents: 2000 (que son 20.00 pesos)
-- Si aparece como 200000, entonces el problema es en el guardado

-- 3. Verificar específicamente el costo "prueba 3"
SELECT 
    id,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    'Esperado: 2000 centavos = 20 pesos' as esperado
FROM fixed_costs
WHERE LOWER(concept) LIKE '%prueba%3%'
   OR LOWER(concept) LIKE '%prueba 3%';

-- 4. Si necesitas corregir valores mal guardados (SOLO si confirmaste que están mal):
-- UPDATE fixed_costs 
-- SET amount_cents = amount_cents / 100
-- WHERE amount_cents > 1000000; -- Solo corregir valores obviamente incorrectos