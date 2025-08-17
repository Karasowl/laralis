-- Debug: Verificar estado actual del sistema de marketing

-- 1. Verificar si existe la tabla marketing_campaigns
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- 2. Verificar categorías existentes
SELECT 
    entity_type, 
    name, 
    display_name, 
    is_system,
    display_order,
    COUNT(*) as count
FROM public.categories 
GROUP BY entity_type, name, display_name, is_system, display_order
ORDER BY entity_type, display_order;

-- 3. Verificar columnas de patients
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'patients'
AND column_name IN ('source_id', 'campaign_id', 'referred_by_patient_id', 'campaign_name', 'acquisition_date')
ORDER BY ordinal_position;

-- 4. Listar todas las tablas que contienen 'marketing' o 'campaign'
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%marketing%' OR table_name LIKE '%campaign%');
