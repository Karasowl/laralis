-- =====================================================
-- Script: Verificar Estructura Actual de la Base de Datos
-- Fecha: 2025-08-31
-- Descripción: Consultar la estructura real antes de hacer cambios
-- =====================================================

-- 1. Ver columnas de la tabla patients
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- 2. Ver columnas de la tabla marketing_campaigns
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- 3. Ver columnas de la tabla categories
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 4. Ver vistas existentes relacionadas con patients
SELECT 
    table_name as view_name
FROM information_schema.views
WHERE view_definition LIKE '%patients%'
ORDER BY table_name;

-- 5. Ver definición de las vistas problemáticas
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_name IN ('patient_source_stats', 'patient_acquisition_report', 'campaign_stats');

-- 6. Ver foreign keys de patients
SELECT
    tc.constraint_name,
    tc.constraint_type,
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