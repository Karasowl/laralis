-- Script para verificar y arreglar fixed_costs

-- Ver todos los costos fijos actuales
SELECT 
    id,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    created_at
FROM fixed_costs
ORDER BY created_at DESC;

-- Si hay montos incorrectos (mayores a 100000 centavos = 1000 pesos)
-- Ejecuta esto para corregirlos:
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100
WHERE amount_cents > 100000;

-- Verificar después de la corrección
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY created_at DESC;