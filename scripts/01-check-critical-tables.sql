-- =====================================================
-- REVISAR COLUMNAS DE TABLAS CRÍTICAS
-- =====================================================

-- 1. COLUMNAS DE marketing_campaigns
SELECT 
    'marketing_campaigns' as tabla,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- 2. COLUMNAS DE patients  
SELECT 
    'patients' as tabla,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- 3. COLUMNAS DE patient_sources
SELECT 
    'patient_sources' as tabla,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_sources'
ORDER BY ordinal_position;

-- 4. Ver si ya existen las columnas nuevas
SELECT 
    column_name,
    'EXISTS' as status
FROM information_schema.columns
WHERE table_name = 'patients'
AND column_name IN ('acquisition_type', 'acquisition_details', 'platform_id', 'source_id');