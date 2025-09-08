-- =====================================================
-- Script: ULTRA MINIMALISTA - Solo columnas básicas
-- Fecha: 2025-08-31
-- Descripción: Sin asumir NINGUNA columna específica
-- =====================================================

-- 1. Eliminar source_id con CASCADE
ALTER TABLE patients 
DROP COLUMN IF EXISTS source_id CASCADE;

-- 2. Agregar nuevas columnas
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50);

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_details JSONB;

-- 3. Migración super simple
UPDATE patients p
SET 
    acquisition_type = CASE
        WHEN p.campaign_id IS NOT NULL THEN 'campaign'
        WHEN p.referred_by_patient_id IS NOT NULL THEN 'referral'
        WHEN p.platform_id IS NOT NULL THEN 'organic'
        ELSE 'direct'
    END
WHERE p.acquisition_type IS NULL;

-- 4. Vista mínima
CREATE OR REPLACE VIEW patient_acquisition_unified AS
SELECT 
    p.id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.created_at as acquisition_date,
    COALESCE(p.acquisition_type, 'direct') as acquisition_type,
    p.campaign_id,
    p.referred_by_patient_id,
    p.platform_id
FROM patients p;

-- 5. Vista de estadísticas mínima
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
    clinic_id,
    acquisition_type,
    COUNT(*) as patient_count
FROM patient_acquisition_unified
GROUP BY clinic_id, acquisition_type;

-- 6. Vista de reporte mínima
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    clinic_id,
    acquisition_type,
    DATE_TRUNC('month', acquisition_date) as month,
    COUNT(*) as new_patients
FROM patient_acquisition_unified
GROUP BY clinic_id, acquisition_type, DATE_TRUNC('month', acquisition_date);

-- 7. Vista de campañas SOLO con columnas que seguro existen
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    mc.id,
    mc.clinic_id,
    mc.name as campaign_name,
    COUNT(p.id) as total_patients
FROM marketing_campaigns mc
LEFT JOIN patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.clinic_id, mc.name;

-- 8. Verificación
SELECT 
    'Migración ultra mínima completada' as status,
    COUNT(*) as total_patients
FROM patients;