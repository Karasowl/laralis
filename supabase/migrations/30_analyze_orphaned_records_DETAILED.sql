-- ============================================================================
-- ANÁLISIS DETALLADO DE DATOS HUÉRFANOS CON INFORMACIÓN REAL
-- Este script muestra DATOS REALES, no solo conteos
-- ============================================================================

-- ============================================================================
-- 1. WORKSPACES Y MEMBRESÍAS
-- ============================================================================

SELECT '=== WORKSPACES ACTUALES ===' as section;

SELECT
    w.id,
    w.name as workspace_name,
    w.owner_id,
    au.email as owner_email,
    w.created_at,
    (SELECT COUNT(*) FROM public.clinics WHERE workspace_id = w.id) as clinic_count,
    (SELECT COUNT(*) FROM public.workspace_members WHERE workspace_id = w.id) as member_count
FROM public.workspaces w
LEFT JOIN auth.users au ON w.owner_id = au.id
ORDER BY w.created_at DESC;

-- ============================================================================

SELECT '=== WORKSPACE MEMBERS (Membresías de usuarios) ===' as section;

SELECT
    wm.id,
    wm.workspace_id,
    w.name as workspace_name,
    wm.user_id,
    au.email as user_email,
    wm.role,
    wm.created_at,
    CASE
        WHEN wm.workspace_id NOT IN (SELECT id FROM public.workspaces) THEN '❌ WORKSPACE NO EXISTE'
        WHEN wm.user_id NOT IN (SELECT id FROM auth.users) THEN '❌ USER NO EXISTE'
        ELSE '✅ OK'
    END as status
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON wm.workspace_id = w.id
LEFT JOIN auth.users au ON wm.user_id = au.id
ORDER BY wm.created_at DESC;

-- ============================================================================

SELECT '=== WORKSPACE MEMBERS HUÉRFANOS (CON PROBLEMAS) ===' as section;

SELECT
    wm.id,
    wm.workspace_id,
    wm.user_id,
    wm.email as member_email,
    wm.role,
    CASE
        WHEN wm.workspace_id NOT IN (SELECT id FROM public.workspaces) THEN '❌ El workspace_id no existe en tabla workspaces'
        WHEN wm.user_id NOT IN (SELECT id FROM auth.users) THEN '❌ El user_id no existe en auth.users'
    END as problema
FROM public.workspace_members wm
WHERE wm.workspace_id NOT IN (SELECT id FROM public.workspaces)
   OR wm.user_id NOT IN (SELECT id FROM auth.users);

-- Si no hay resultados, mostrar mensaje
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay workspace_members huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' workspace_members huérfanos (ver tabla anterior)'
    END as resultado
FROM public.workspace_members wm
WHERE wm.workspace_id NOT IN (SELECT id FROM public.workspaces)
   OR wm.user_id NOT IN (SELECT id FROM auth.users);

-- ============================================================================
-- 2. CLÍNICAS
-- ============================================================================

SELECT '=== CLÍNICAS ACTUALES ===' as section;

SELECT
    c.id,
    c.name as clinic_name,
    c.workspace_id,
    w.name as workspace_name,
    w.owner_id,
    au.email as workspace_owner_email,
    c.created_at,
    (SELECT COUNT(*) FROM public.patients WHERE clinic_id = c.id) as patient_count,
    (SELECT COUNT(*) FROM public.treatments WHERE clinic_id = c.id) as treatment_count,
    (SELECT COUNT(*) FROM public.services WHERE clinic_id = c.id) as service_count,
    (SELECT COUNT(*) FROM public.supplies WHERE clinic_id = c.id) as supply_count
FROM public.clinics c
LEFT JOIN public.workspaces w ON c.workspace_id = w.id
LEFT JOIN auth.users au ON w.owner_id = au.id
ORDER BY c.created_at DESC;

-- ============================================================================

SELECT '=== CLÍNICAS HUÉRFANAS ===' as section;

SELECT
    c.id,
    c.name as clinic_name,
    c.workspace_id,
    c.created_at,
    '❌ El workspace_id no existe en tabla workspaces' as problema
FROM public.clinics c
WHERE c.workspace_id IS NOT NULL
  AND c.workspace_id NOT IN (SELECT id FROM public.workspaces);

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay clínicas huérfanas'
        ELSE '❌ Hay ' || COUNT(*) || ' clínicas huérfanas (ver tabla anterior)'
    END as resultado
FROM public.clinics c
WHERE c.workspace_id IS NOT NULL
  AND c.workspace_id NOT IN (SELECT id FROM public.workspaces);

-- ============================================================================
-- 3. PACIENTES
-- ============================================================================

SELECT '=== PACIENTES POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(p.id) as patient_count,
    MIN(p.created_at) as first_patient,
    MAX(p.created_at) as last_patient
FROM public.clinics c
LEFT JOIN public.patients p ON p.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY patient_count DESC;

-- ============================================================================

SELECT '=== PACIENTES HUÉRFANOS ===' as section;

SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.clinic_id,
    p.created_at,
    '❌ La clinic_id no existe en tabla clinics' as problema
FROM public.patients p
WHERE p.clinic_id NOT IN (SELECT id FROM public.clinics)
ORDER BY p.created_at DESC
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay pacientes huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' pacientes huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.patients p
WHERE p.clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- 4. TRATAMIENTOS
-- ============================================================================

SELECT '=== TRATAMIENTOS POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(t.id) as treatment_count,
    SUM(t.price_cents) / 100.0 as total_revenue,
    MIN(t.created_at) as first_treatment,
    MAX(t.created_at) as last_treatment
FROM public.clinics c
LEFT JOIN public.treatments t ON t.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY treatment_count DESC;

-- ============================================================================

SELECT '=== TRATAMIENTOS HUÉRFANOS ===' as section;

SELECT
    t.id,
    t.clinic_id,
    t.patient_id,
    t.service_id,
    s.name as service_name,
    t.price_cents / 100.0 as price,
    t.treatment_date,
    t.status,
    CASE
        WHEN t.clinic_id NOT IN (SELECT id FROM public.clinics) THEN '❌ clinic_id no existe'
        WHEN t.patient_id NOT IN (SELECT id FROM public.patients) THEN '❌ patient_id no existe'
    END as problema
FROM public.treatments t
LEFT JOIN public.services s ON t.service_id = s.id
WHERE t.clinic_id NOT IN (SELECT id FROM public.clinics)
   OR t.patient_id NOT IN (SELECT id FROM public.patients)
ORDER BY t.created_at DESC
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay tratamientos huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' tratamientos huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.treatments t
WHERE t.clinic_id NOT IN (SELECT id FROM public.clinics)
   OR t.patient_id NOT IN (SELECT id FROM public.patients);

-- ============================================================================
-- 5. INSUMOS (SUPPLIES)
-- ============================================================================

SELECT '=== INSUMOS POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(s.id) as supply_count,
    SUM(s.price_cents) / 100.0 as total_inventory_value
FROM public.clinics c
LEFT JOIN public.supplies s ON s.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY supply_count DESC;

-- ============================================================================

SELECT '=== INSUMOS HUÉRFANOS ===' as section;

SELECT
    s.id,
    s.name,
    s.category,
    s.price_cents / 100.0 as price,
    s.portions,
    s.clinic_id,
    s.created_at,
    '❌ La clinic_id no existe en tabla clinics' as problema
FROM public.supplies s
WHERE s.clinic_id NOT IN (SELECT id FROM public.clinics)
ORDER BY s.created_at DESC
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay insumos huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' insumos huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.supplies s
WHERE s.clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- 6. SERVICIOS
-- ============================================================================

SELECT '=== SERVICIOS POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(sv.id) as service_count
FROM public.clinics c
LEFT JOIN public.services sv ON sv.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY service_count DESC;

-- ============================================================================

SELECT '=== SERVICIOS HUÉRFANOS ===' as section;

SELECT
    sv.id,
    sv.name,
    sv.est_minutes,
    sv.category,
    sv.clinic_id,
    sv.created_at,
    '❌ La clinic_id no existe en tabla clinics' as problema
FROM public.services sv
WHERE sv.clinic_id NOT IN (SELECT id FROM public.clinics)
ORDER BY sv.created_at DESC
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay servicios huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' servicios huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.services sv
WHERE sv.clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- 7. SERVICE_SUPPLIES (Relación servicio-insumo)
-- ============================================================================

SELECT '=== SERVICE_SUPPLIES HUÉRFANOS ===' as section;

SELECT
    ss.id,
    ss.service_id,
    ss.supply_id,
    ss.quantity,
    CASE
        WHEN ss.service_id NOT IN (SELECT id FROM public.services) THEN '❌ service_id no existe'
        WHEN ss.supply_id NOT IN (SELECT id FROM public.supplies) THEN '❌ supply_id no existe'
    END as problema
FROM public.service_supplies ss
WHERE ss.service_id NOT IN (SELECT id FROM public.services)
   OR ss.supply_id NOT IN (SELECT id FROM public.supplies)
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay service_supplies huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' service_supplies huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.service_supplies ss
WHERE ss.service_id NOT IN (SELECT id FROM public.services)
   OR ss.supply_id NOT IN (SELECT id FROM public.supplies);

-- ============================================================================
-- 8. GASTOS (EXPENSES)
-- ============================================================================

SELECT '=== GASTOS POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(e.id) as expense_count,
    SUM(e.amount_cents) / 100.0 as total_expenses
FROM public.clinics c
LEFT JOIN public.expenses e ON e.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY total_expenses DESC;

-- ============================================================================

SELECT '=== GASTOS HUÉRFANOS ===' as section;

SELECT
    e.id,
    e.concept,
    e.amount_cents / 100.0 as amount,
    e.expense_date,
    e.clinic_id,
    '❌ La clinic_id no existe en tabla clinics' as problema
FROM public.expenses e
WHERE e.clinic_id NOT IN (SELECT id FROM public.clinics)
ORDER BY e.created_at DESC
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay gastos huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' gastos huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.expenses e
WHERE e.clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- 9. COSTOS FIJOS
-- ============================================================================

SELECT '=== COSTOS FIJOS POR CLÍNICA ===' as section;

SELECT
    c.name as clinic_name,
    COUNT(fc.id) as fixed_cost_count,
    SUM(fc.amount_cents) / 100.0 as total_monthly_fixed_costs
FROM public.clinics c
LEFT JOIN public.fixed_costs fc ON fc.clinic_id = c.id
GROUP BY c.id, c.name
ORDER BY total_monthly_fixed_costs DESC;

-- ============================================================================

SELECT '=== COSTOS FIJOS HUÉRFANOS ===' as section;

SELECT
    fc.id,
    fc.category,
    fc.concept,
    fc.amount_cents / 100.0 as amount,
    fc.clinic_id,
    '❌ La clinic_id no existe en tabla clinics' as problema
FROM public.fixed_costs fc
WHERE fc.clinic_id NOT IN (SELECT id FROM public.clinics)
LIMIT 50;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ No hay costos fijos huérfanos'
        ELSE '❌ Hay ' || COUNT(*) || ' costos fijos huérfanos (mostrando primeros 50)'
    END as resultado
FROM public.fixed_costs fc
WHERE fc.clinic_id NOT IN (SELECT id FROM public.clinics);

-- ============================================================================
-- 10. RESUMEN GENERAL
-- ============================================================================

SELECT '=== RESUMEN GENERAL DE LA BASE DE DATOS ===' as section;

WITH counts AS (
    SELECT
        'Workspaces' as entity,
        COUNT(*) as total,
        0 as orphaned
    FROM public.workspaces

    UNION ALL

    SELECT
        'Workspace Members' as entity,
        COUNT(*) as total,
        (SELECT COUNT(*) FROM public.workspace_members wm
         WHERE wm.workspace_id NOT IN (SELECT id FROM public.workspaces)
            OR wm.user_id NOT IN (SELECT id FROM auth.users)) as orphaned
    FROM public.workspace_members

    UNION ALL

    SELECT
        'Clinics',
        COUNT(*),
        (SELECT COUNT(*) FROM public.clinics c
         WHERE c.workspace_id IS NOT NULL
           AND c.workspace_id NOT IN (SELECT id FROM public.workspaces))
    FROM public.clinics

    UNION ALL

    SELECT
        'Patients',
        COUNT(*),
        (SELECT COUNT(*) FROM public.patients p
         WHERE p.clinic_id NOT IN (SELECT id FROM public.clinics))
    FROM public.patients

    UNION ALL

    SELECT
        'Treatments',
        COUNT(*),
        (SELECT COUNT(*) FROM public.treatments t
         WHERE t.clinic_id NOT IN (SELECT id FROM public.clinics)
            OR t.patient_id NOT IN (SELECT id FROM public.patients))
    FROM public.treatments

    UNION ALL

    SELECT
        'Supplies',
        COUNT(*),
        (SELECT COUNT(*) FROM public.supplies s
         WHERE s.clinic_id NOT IN (SELECT id FROM public.clinics))
    FROM public.supplies

    UNION ALL

    SELECT
        'Services',
        COUNT(*),
        (SELECT COUNT(*) FROM public.services sv
         WHERE sv.clinic_id NOT IN (SELECT id FROM public.clinics))
    FROM public.services

    UNION ALL

    SELECT
        'Service Supplies',
        COUNT(*),
        (SELECT COUNT(*) FROM public.service_supplies ss
         WHERE ss.service_id NOT IN (SELECT id FROM public.services)
            OR ss.supply_id NOT IN (SELECT id FROM public.supplies))
    FROM public.service_supplies

    UNION ALL

    SELECT
        'Expenses',
        COUNT(*),
        (SELECT COUNT(*) FROM public.expenses e
         WHERE e.clinic_id NOT IN (SELECT id FROM public.clinics))
    FROM public.expenses

    UNION ALL

    SELECT
        'Fixed Costs',
        COUNT(*),
        (SELECT COUNT(*) FROM public.fixed_costs fc
         WHERE fc.clinic_id NOT IN (SELECT id FROM public.clinics))
    FROM public.fixed_costs
)
SELECT
    entity,
    total as total_records,
    orphaned as orphaned_records,
    CASE
        WHEN orphaned = 0 THEN '✅ OK'
        ELSE '❌ TIENE HUÉRFANOS'
    END as status,
    CASE
        WHEN total > 0 THEN ROUND((orphaned::numeric / total::numeric * 100), 2)
        ELSE 0
    END as orphan_percentage
FROM counts
ORDER BY orphaned_records DESC, entity;

-- ============================================================================
-- FIN DEL ANÁLISIS
-- ============================================================================

SELECT '========================================' as final;
SELECT '✅ Análisis completo terminado' as final;
SELECT 'Revisa los resultados anteriores para ver datos específicos' as final;
SELECT '========================================' as final;
