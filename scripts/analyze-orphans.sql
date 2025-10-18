-- ============================================================================
-- ANÁLISIS DE DATOS HUÉRFANOS - TODO EN UNA SOLA TABLA
-- Este script devuelve TODO el análisis en UNA SOLA TABLA VISIBLE
-- ============================================================================

WITH fk_list AS (
    -- Obtener todas las foreign keys
    SELECT
        tc.table_name as child_table,
        kcu.column_name as fk_column,
        ccu.table_name as parent_table,
        ccu.column_name as parent_column,
        ccu.table_schema as parent_schema,
        rc.delete_rule
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
),

-- Verificación de huérfanos para workspace_members.workspace_id
check_workspace_members_workspace AS (
    SELECT
        'workspace_members' as tabla,
        'workspace_id' as columna,
        'workspaces.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.workspace_members
    WHERE workspace_id NOT IN (SELECT id FROM public.workspaces)
),

-- Verificación de huérfanos para clinics.workspace_id
check_clinics_workspace AS (
    SELECT
        'clinics' as tabla,
        'workspace_id' as columna,
        'workspaces.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.clinics
    WHERE workspace_id IS NOT NULL
      AND workspace_id NOT IN (SELECT id FROM public.workspaces)
),

-- Verificación de huérfanos para patients.clinic_id
check_patients_clinic AS (
    SELECT
        'patients' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.patients
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para treatments.clinic_id (SIN FK)
check_treatments_clinic AS (
    SELECT
        'treatments' as tabla,
        'clinic_id' as columna,
        'clinics.id (SIN FK)' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.treatments
    WHERE clinic_id IS NOT NULL
      AND clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para treatments.patient_id
check_treatments_patient AS (
    SELECT
        'treatments' as tabla,
        'patient_id' as columna,
        'patients.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.treatments
    WHERE patient_id NOT IN (SELECT id FROM public.patients)
),

-- Verificación de huérfanos para treatments.service_id
check_treatments_service AS (
    SELECT
        'treatments' as tabla,
        'service_id' as columna,
        'services.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.treatments
    WHERE service_id NOT IN (SELECT id FROM public.services)
),

-- Verificación de huérfanos para services.clinic_id
check_services_clinic AS (
    SELECT
        'services' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.services
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para supplies.clinic_id
check_supplies_clinic AS (
    SELECT
        'supplies' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.supplies
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para service_supplies.service_id
check_service_supplies_service AS (
    SELECT
        'service_supplies' as tabla,
        'service_id' as columna,
        'services.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.service_supplies
    WHERE service_id NOT IN (SELECT id FROM public.services)
),

-- Verificación de huérfanos para service_supplies.supply_id
check_service_supplies_supply AS (
    SELECT
        'service_supplies' as tabla,
        'supply_id' as columna,
        'supplies.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.service_supplies
    WHERE supply_id NOT IN (SELECT id FROM public.supplies)
),

-- Verificación de huérfanos para expenses.clinic_id
check_expenses_clinic AS (
    SELECT
        'expenses' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.expenses
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para fixed_costs.clinic_id
check_fixed_costs_clinic AS (
    SELECT
        'fixed_costs' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.fixed_costs
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para assets.clinic_id
check_assets_clinic AS (
    SELECT
        'assets' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.assets
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para settings_time.clinic_id
check_settings_time_clinic AS (
    SELECT
        'settings_time' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.settings_time
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para tariffs.clinic_id
check_tariffs_clinic AS (
    SELECT
        'tariffs' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.tariffs
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para marketing_campaigns.clinic_id
check_campaigns_clinic AS (
    SELECT
        'marketing_campaigns' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.marketing_campaigns
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para patient_sources.clinic_id
check_patient_sources_clinic AS (
    SELECT
        'patient_sources' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.patient_sources
    WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Verificación de huérfanos para patients.source_id
check_patients_source AS (
    SELECT
        'patients' as tabla,
        'source_id' as columna,
        'patient_sources.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.patients
    WHERE source_id IS NOT NULL
      AND source_id NOT IN (SELECT id FROM public.patient_sources)
),

-- Verificación de huérfanos para workspace_activity.workspace_id
check_workspace_activity_workspace AS (
    SELECT
        'workspace_activity' as tabla,
        'workspace_id' as columna,
        'workspaces.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.workspace_activity
    WHERE workspace_id NOT IN (SELECT id FROM public.workspaces)
),

-- Verificación de huérfanos para workspace_activity.clinic_id
check_workspace_activity_clinic AS (
    SELECT
        'workspace_activity' as tabla,
        'clinic_id' as columna,
        'clinics.id' as apunta_a,
        COUNT(*) as huerfanos
    FROM public.workspace_activity
    WHERE clinic_id IS NOT NULL
      AND clinic_id NOT IN (SELECT id FROM public.clinics)
),

-- Unir todos los resultados
all_checks AS (
    SELECT * FROM check_workspace_members_workspace
    UNION ALL SELECT * FROM check_clinics_workspace
    UNION ALL SELECT * FROM check_patients_clinic
    UNION ALL SELECT * FROM check_treatments_clinic
    UNION ALL SELECT * FROM check_treatments_patient
    UNION ALL SELECT * FROM check_treatments_service
    UNION ALL SELECT * FROM check_services_clinic
    UNION ALL SELECT * FROM check_supplies_clinic
    UNION ALL SELECT * FROM check_service_supplies_service
    UNION ALL SELECT * FROM check_service_supplies_supply
    UNION ALL SELECT * FROM check_expenses_clinic
    UNION ALL SELECT * FROM check_fixed_costs_clinic
    UNION ALL SELECT * FROM check_assets_clinic
    UNION ALL SELECT * FROM check_settings_time_clinic
    UNION ALL SELECT * FROM check_tariffs_clinic
    UNION ALL SELECT * FROM check_campaigns_clinic
    UNION ALL SELECT * FROM check_patient_sources_clinic
    UNION ALL SELECT * FROM check_patients_source
    UNION ALL SELECT * FROM check_workspace_activity_workspace
    UNION ALL SELECT * FROM check_workspace_activity_clinic
)

-- ============================================================================
-- RESULTADO FINAL: TODO EN UNA SOLA TABLA
-- ============================================================================

SELECT
    row_number() OVER (ORDER BY huerfanos DESC, tabla, columna) as "#",
    tabla as "Tabla",
    columna as "Columna",
    apunta_a as "Apunta a",
    huerfanos as "Huérfanos",
    CASE
        WHEN huerfanos = 0 THEN '✅ OK'
        ELSE '❌ PROBLEMA'
    END as "Estado",
    -- Resumen al final
    CASE
        WHEN row_number() OVER (ORDER BY huerfanos DESC, tabla, columna) = 1
        THEN 'Total verificaciones: ' || (SELECT COUNT(*) FROM all_checks)::text ||
             ' | Con huérfanos: ' || (SELECT COUNT(*) FROM all_checks WHERE huerfanos > 0)::text ||
             ' | Total huérfanos: ' || (SELECT SUM(huerfanos) FROM all_checks)::text ||
             ' | ' || CASE
                WHEN (SELECT SUM(huerfanos) FROM all_checks) = 0
                THEN '🎉 BASE DE DATOS LIMPIA'
                ELSE '⚠️ REQUIERE LIMPIEZA'
             END
        ELSE ''
    END as "Resumen General"
FROM all_checks
ORDER BY huerfanos DESC, tabla, columna;
