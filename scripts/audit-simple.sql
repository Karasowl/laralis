-- =====================================================
-- AUDITORÍA SIMPLE - EJECUTAR LÍNEA POR LÍNEA SI ES NECESARIO
-- =====================================================

-- 1. ESTRUCTURA DE TABLA PATIENTS
SELECT '====== TABLA PATIENTS ======' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- 2. ESTRUCTURA DE TABLA MARKETING_CAMPAIGNS
SELECT '====== TABLA MARKETING_CAMPAIGNS ======' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- 3. ESTRUCTURA DE TABLA PATIENT_SOURCES
SELECT '====== TABLA PATIENT_SOURCES ======' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_sources'
ORDER BY ordinal_position;

-- 4. ESTRUCTURA DE TABLA CATEGORIES
SELECT '====== TABLA CATEGORIES ======' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 5. VERIFICAR COLUMNAS ESPECÍFICAS EN PATIENTS
SELECT '====== COLUMNAS A VERIFICAR ======' as info;
SELECT 
    'source_id' as columna,
    CASE WHEN column_name IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as estado
FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'source_id'
UNION ALL
SELECT 
    'acquisition_type' as columna,
    CASE WHEN column_name IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as estado
FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'acquisition_type'
UNION ALL
SELECT 
    'acquisition_details' as columna,
    CASE WHEN column_name IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as estado
FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'acquisition_details'
UNION ALL
SELECT 
    'platform_id' as columna,
    CASE WHEN column_name IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as estado
FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'platform_id'
UNION ALL
SELECT 
    'campaign_id' as columna,
    CASE WHEN column_name IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as estado
FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'campaign_id';

-- 6. FOREIGN KEYS EN PATIENTS
SELECT '====== FOREIGN KEYS PATIENTS ======' as info;
SELECT
    kcu.column_name as columna_origen,
    ccu.table_name AS tabla_destino,
    ccu.column_name AS columna_destino
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'patients'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 7. VISTAS QUE DEPENDEN DE PATIENTS
SELECT '====== VISTAS DEPENDIENTES ======' as info;
SELECT table_name as vista_nombre
FROM information_schema.views
WHERE view_definition LIKE '%patients%'
   OR view_definition LIKE '%source_id%'
ORDER BY table_name;

-- 8. ESTADÍSTICAS RÁPIDAS
SELECT '====== ESTADÍSTICAS ======' as info;
SELECT 
    'Total pacientes' as dato,
    COUNT(*)::TEXT as valor
FROM patients
UNION ALL
SELECT 
    'Con source_id' as dato,
    COUNT(*)::TEXT as valor
FROM patients WHERE source_id IS NOT NULL
UNION ALL
SELECT 
    'Con campaign_id' as dato,
    COUNT(*)::TEXT as valor
FROM patients WHERE campaign_id IS NOT NULL;

-- 9. MUESTRA DE DATOS DE PATIENT_SOURCES
SELECT '====== MUESTRA PATIENT_SOURCES ======' as info;
SELECT * FROM patient_sources LIMIT 3;

-- 10. MUESTRA DE DATOS DE MARKETING_CAMPAIGNS
SELECT '====== MUESTRA MARKETING_CAMPAIGNS ======' as info;
SELECT * FROM marketing_campaigns LIMIT 3;