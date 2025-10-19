-- =====================================================
-- DIAGNÓSTICO: Service Recipes
-- =====================================================
-- Verifica cuántos servicios tienen recetas (service_supplies)
-- =====================================================

SELECT
    '========================================' as "INFO",
    'DIAGNÓSTICO DE RECETAS DE SERVICIOS' as "",
    '========================================' as " ";

-- 1. Contar todos los servicios
SELECT
    '1. Total de servicios' as "Paso",
    COUNT(*) as "Cantidad"
FROM services;

-- 2. Servicios SIN receta (service_supplies vacío)
SELECT
    '2. Servicios SIN receta' as "Paso",
    COUNT(*) as "Cantidad"
FROM services s
WHERE NOT EXISTS (
    SELECT 1 FROM service_supplies ss
    WHERE ss.service_id = s.id
);

-- 3. Servicios CON receta
SELECT
    '3. Servicios CON receta' as "Paso",
    COUNT(*) as "Cantidad"
FROM services s
WHERE EXISTS (
    SELECT 1 FROM service_supplies ss
    WHERE ss.service_id = s.id
);

-- 4. Detalle de cada servicio
SELECT
    s.id as "Service ID",
    s.name as "Nombre",
    s.category as "Categoría",
    s.est_minutes as "Minutos",
    s.price_cents / 100.0 as "Precio ($)",
    COUNT(ss.id) as "Items en Receta",
    CASE
        WHEN COUNT(ss.id) = 0 THEN '❌ SIN RECETA'
        ELSE '✅ CON RECETA'
    END as "Estado"
FROM services s
LEFT JOIN service_supplies ss ON ss.service_id = s.id
GROUP BY s.id, s.name, s.category, s.est_minutes, s.price_cents
ORDER BY s.name;

-- 5. Detalle de insumos por servicio (solo servicios con receta)
SELECT
    s.name as "Servicio",
    sup.name as "Insumo",
    ss.qty as "Cantidad",
    sup.price_cents / 100.0 as "Precio Insumo ($)"
FROM service_supplies ss
JOIN services s ON s.id = ss.service_id
JOIN supplies sup ON sup.id = ss.supply_id
ORDER BY s.name, sup.name;

-- 6. Resumen final
SELECT
    '========================================' as "INFO",
    'RESUMEN' as "",
    '========================================' as " ";

SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM services WHERE EXISTS (SELECT 1 FROM service_supplies ss WHERE ss.service_id = services.id)) > 0
        THEN '✅ REQUIREMENT service_recipe DEBERÍA ESTAR COMPLETO'
        ELSE '❌ REQUIREMENT service_recipe NO ESTÁ COMPLETO'
    END as "Estado del Requirement";

SELECT
    'Para completar el requirement service_recipe:' as "Instrucciones",
    '1. Ve a /services' as "Paso 1",
    '2. Edita el servicio (ícono ✏️)' as "Paso 2",
    '3. En la sección "Supplies" agrega al menos 1 insumo' as "Paso 3",
    '4. Guarda el servicio' as "Paso 4",
    '5. Ve a /setup y presiona "Refresh"' as "Paso 5";
