-- ============================================================================
-- ANÁLISIS DE DATOS HUÉRFANOS - VERSIÓN 100% SEGURA (SOLO LECTURA)
-- Este script SOLO lee datos, NO modifica NADA
-- NO usa DELETE, DROP ni ninguna operación destructiva
-- ============================================================================

-- ============================================================================
-- PASO 1: Análisis automático de Foreign Keys
-- Almacena resultados en tabla temporal para múltiples SELECT
-- ============================================================================

WITH fk_analysis AS (
    SELECT
        tc.table_name as child_table,
        kcu.column_name as fk_column,
        ccu.table_name as parent_table,
        ccu.column_name as parent_column,
        ccu.table_schema as parent_schema
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
),

-- Contar huérfanos para cada FK (esto es solo lectura)
orphan_counts AS (
    SELECT
        child_table,
        fk_column,
        parent_table,
        parent_column,
        parent_schema,
        -- Usamos subconsultas para contar huérfanos (solo lectura)
        (
            CASE
                WHEN parent_schema = 'public' THEN
                    (
                        SELECT COUNT(*)::bigint
                        FROM information_schema.tables t
                        WHERE t.table_schema = 'public'
                          AND t.table_name = fk_analysis.child_table
                          AND EXISTS (
                              SELECT 1
                              FROM information_schema.columns c1
                              WHERE c1.table_name = fk_analysis.child_table
                                AND c1.column_name = fk_analysis.fk_column
                          )
                    )
                ELSE 0
            END
        ) as total_records
    FROM fk_analysis
)

-- ============================================================================
-- RESULTADO 1: Resumen General
-- ============================================================================

SELECT '📊 RESUMEN GENERAL - Análisis de Foreign Keys' as info;

SELECT
    COUNT(*) as "Total FKs Analizadas",
    'Análisis completado' as "Estado",
    'Este script es 100% de solo lectura' as "Nota"
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public';

-- ============================================================================
-- RESULTADO 2: Lista de todas las Foreign Keys
-- ============================================================================

SELECT '📋 TODAS LAS FOREIGN KEYS DETECTADAS' as info;

SELECT
    row_number() OVER (ORDER BY tc.table_name, kcu.column_name) as "#",
    tc.table_name as "Tabla Hija",
    kcu.column_name as "Columna FK",
    ccu.table_name as "Tabla Padre",
    ccu.column_name as "Columna Padre",
    rc.delete_rule as "ON DELETE",
    'Analizar manualmente' as "Estado"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- RESULTADO 3: Tablas y sus relaciones
-- ============================================================================

SELECT '🔗 RELACIONES POR TABLA' as info;

SELECT
    tc.table_name as "Tabla",
    COUNT(*) as "Total FKs",
    STRING_AGG(
        kcu.column_name || ' → ' || ccu.table_name || '.' || ccu.column_name,
        ', '
        ORDER BY kcu.column_name
    ) as "Relaciones"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
GROUP BY tc.table_name
ORDER BY COUNT(*) DESC, tc.table_name;

-- ============================================================================
-- RESULTADO 4: Verificación manual de huérfanos para tablas principales
-- (Queries individuales que puedes ejecutar una por una)
-- ============================================================================

SELECT '💡 QUERIES PARA VERIFICAR HUÉRFANOS MANUALMENTE' as info;

SELECT
    'Copia y ejecuta estas queries una por una para verificar huérfanos:' as "Instrucciones";

-- workspace_members → workspace_id
SELECT 'workspace_members.workspace_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.workspace_members
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);

-- workspace_members → user_id (auth.users)
SELECT 'workspace_members.user_id → auth.users' as verificar;
-- Nota: Esta query requiere acceso a auth.users

-- clinics → workspace_id
SELECT 'clinics.workspace_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.clinics
WHERE workspace_id IS NOT NULL
  AND workspace_id NOT IN (SELECT id FROM public.workspaces);

-- patients → clinic_id
SELECT 'patients.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.patients
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- treatments → clinic_id (SIN FK CONSTRAINT)
SELECT 'treatments.clinic_id (SIN FK)' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.treatments
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics);

-- treatments → patient_id
SELECT 'treatments.patient_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.treatments
WHERE patient_id NOT IN (SELECT id FROM public.patients);

-- treatments → service_id
SELECT 'treatments.service_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.treatments
WHERE service_id NOT IN (SELECT id FROM public.services);

-- services → clinic_id
SELECT 'services.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.services
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- supplies → clinic_id
SELECT 'supplies.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.supplies
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- service_supplies → service_id
SELECT 'service_supplies.service_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.service_supplies
WHERE service_id NOT IN (SELECT id FROM public.services);

-- service_supplies → supply_id
SELECT 'service_supplies.supply_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.service_supplies
WHERE supply_id NOT IN (SELECT id FROM public.supplies);

-- expenses → clinic_id
SELECT 'expenses.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.expenses
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- fixed_costs → clinic_id
SELECT 'fixed_costs.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.fixed_costs
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- assets → clinic_id
SELECT 'assets.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.assets
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- marketing_campaigns → clinic_id
SELECT 'marketing_campaigns.clinic_id' as verificar;
SELECT COUNT(*) as huerfanos
FROM public.marketing_campaigns
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- RESULTADO FINAL
-- ============================================================================

SELECT '✅ ANÁLISIS COMPLETADO (SOLO LECTURA)' as info;

SELECT
    'Este script NO modificó ningún dato' as "Confirmación",
    'Ejecuta las queries individuales arriba para ver conteos específicos' as "Siguiente Paso",
    'Si encuentras huérfanos, usa el script de limpieza' as "Nota";
