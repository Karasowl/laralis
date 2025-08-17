-- Debug simple: Estado actual del sistema

-- 1. ¿Existe la tabla marketing_campaigns?
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'marketing_campaigns'
    ) THEN 'marketing_campaigns EXISTS' 
    ELSE 'marketing_campaigns NOT EXISTS' END as table_status;

-- 2. ¿Existe la tabla categories?
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'categories'
    ) THEN 'categories EXISTS' 
    ELSE 'categories NOT EXISTS' END as table_status;

-- 3. Listar todas las tablas existentes
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 4. Si existe categories, mostrar tipos de entidad
SELECT DISTINCT entity_type FROM public.categories ORDER BY entity_type;

-- 5. Verificar columnas de patients relacionadas con marketing
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'patients'
AND column_name IN ('source_id', 'campaign_id', 'referred_by_patient_id');
