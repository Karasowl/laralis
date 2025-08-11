-- DEBUG: Ver qué está pasando con fixed_costs

-- 1. Ver los últimos registros
SELECT 
    id,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    created_at
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar si hay un trigger que esté multiplicando
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fixed_costs';

-- 3. Arreglar TODOS los montos incorrectos de una vez
UPDATE fixed_costs 
SET amount_cents = 
    CASE 
        -- Si el monto es claramente incorrecto (más de 10000 pesos = 1000000 centavos)
        WHEN amount_cents > 1000000 THEN amount_cents / 10000  -- Dividir entre 10000 porque está multiplicado dos veces
        -- Si el monto está moderadamente mal (más de 1000 pesos = 100000 centavos)
        WHEN amount_cents > 100000 THEN amount_cents / 100
        ELSE amount_cents
    END;

-- 4. Ver resultado después de la corrección
SELECT 
    'DESPUÉS DE CORRECCIÓN:' as estado,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 10;