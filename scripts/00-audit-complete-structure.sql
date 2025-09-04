-- =====================================================
-- Script: AUDITORÍA COMPLETA DE LA ESTRUCTURA DE SUPABASE
-- Fecha: 2025-08-31
-- Descripción: Revisar TODA la estructura antes de hacer cambios
-- =====================================================

-- ============================================
-- 1. TABLA PATIENTS - Estructura completa
-- ============================================
SELECT '=== TABLA PATIENTS ===' as section;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- ============================================
-- 2. TABLA MARKETING_CAMPAIGNS - Estructura completa
-- ============================================
SELECT '=== TABLA MARKETING_CAMPAIGNS ===' as section;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- ============================================
-- 3. TABLA CATEGORIES - Estructura completa
-- ============================================
SELECT '=== TABLA CATEGORIES ===' as section;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- ============================================
-- 4. TABLA PATIENT_SOURCES - Estructura completa
-- ============================================
SELECT '=== TABLA PATIENT_SOURCES ===' as section;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patient_sources'
ORDER BY ordinal_position;

-- ============================================
-- 5. TABLA CLINICS - Estructura completa
-- ============================================
SELECT '=== TABLA CLINICS ===' as section;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'clinics'
ORDER BY ordinal_position;

-- ============================================
-- 6. TODAS LAS VISTAS que involucran patients
-- ============================================
SELECT '=== VISTAS RELACIONADAS CON PATIENTS ===' as section;
SELECT 
    table_name as view_name
FROM information_schema.views
WHERE view_definition LIKE '%patients%'
   OR table_name LIKE '%patient%'
ORDER BY table_name;

-- ============================================
-- 7. DEFINICIÓN de las vistas críticas
-- ============================================
SELECT '=== DEFINICIÓN DE VISTAS CRÍTICAS ===' as section;
SELECT 
    table_name,
    SUBSTRING(view_definition, 1, 500) as definition_preview
FROM information_schema.views
WHERE table_name IN (
    'patient_source_stats', 
    'patient_acquisition_report', 
    'campaign_stats',
    'patient_acquisition_unified'
);

-- ============================================
-- 8. FOREIGN KEYS de patients
-- ============================================
SELECT '=== FOREIGN KEYS DE PATIENTS ===' as section;
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'patients'
    AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================
-- 9. ÍNDICES en patients
-- ============================================
SELECT '=== ÍNDICES EN PATIENTS ===' as section;
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'patients';

-- ============================================
-- 10. TRIGGERS en patients
-- ============================================
SELECT '=== TRIGGERS EN PATIENTS ===' as section;
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'patients';

-- ============================================
-- 11. VERIFICAR si existen las columnas nuevas
-- ============================================
SELECT '=== VERIFICAR COLUMNAS NUEVAS ===' as section;
SELECT 
    'acquisition_type existe en patients' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' 
            AND column_name = 'acquisition_type'
        ) THEN 'SÍ' 
        ELSE 'NO' 
    END as status
UNION ALL
SELECT 
    'acquisition_details existe en patients' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' 
            AND column_name = 'acquisition_details'
        ) THEN 'SÍ' 
        ELSE 'NO' 
    END as status
UNION ALL
SELECT 
    'platform_id existe en patients' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' 
            AND column_name = 'platform_id'
        ) THEN 'SÍ' 
        ELSE 'NO' 
    END as status;

-- ============================================
-- 12. ESTADÍSTICAS de datos actuales
-- ============================================
SELECT '=== ESTADÍSTICAS DE DATOS ===' as section;
SELECT 
    'Total pacientes' as metric,
    COUNT(*) as value
FROM patients
UNION ALL
SELECT 
    'Pacientes con source_id' as metric,
    COUNT(*) as value
FROM patients WHERE source_id IS NOT NULL
UNION ALL
SELECT 
    'Pacientes con campaign_id' as metric,
    COUNT(*) as value
FROM patients WHERE campaign_id IS NOT NULL
UNION ALL
SELECT 
    'Pacientes con referred_by' as metric,
    COUNT(*) as value
FROM patients WHERE referred_by_patient_id IS NOT NULL
UNION ALL
SELECT 
    'Total campañas' as metric,
    COUNT(*) as value
FROM marketing_campaigns
UNION ALL
SELECT 
    'Total patient_sources' as metric,
    COUNT(*) as value
FROM patient_sources;

-- ============================================
-- 13. SAMPLE de patient_sources
-- ============================================
SELECT '=== SAMPLE DE PATIENT_SOURCES ===' as section;
SELECT * FROM patient_sources LIMIT 5;

-- ============================================
-- 14. SAMPLE de marketing_campaigns
-- ============================================
SELECT '=== SAMPLE DE MARKETING_CAMPAIGNS ===' as section;
SELECT * FROM marketing_campaigns LIMIT 5;

-- ============================================
-- 15. RESUMEN FINAL
-- ============================================
SELECT '=== RESUMEN ===' as section;
SELECT 
    'Estructura auditada' as status,
    NOW() as audit_time;