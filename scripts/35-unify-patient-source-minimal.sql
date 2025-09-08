-- =====================================================
-- Script: Unificación Minimalista del Sistema de Origen
-- Fecha: 2025-08-31
-- Descripción: Script conservador que no asume campos inexistentes
-- =====================================================

-- 1. FORZAR ELIMINACIÓN DE LA COLUMNA CON CASCADE
ALTER TABLE patients 
DROP COLUMN IF EXISTS source_id CASCADE;

-- 2. Agregar nuevas columnas si no existen
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50) 
CHECK (acquisition_type IN ('campaign', 'referral', 'organic', 'direct'));

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_details JSONB;

-- 3. Agregar platform_id si no existe
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES categories(id);

-- 4. Migrar datos existentes al nuevo formato (versión simplificada)
UPDATE patients p
SET 
    acquisition_type = CASE
        WHEN p.campaign_id IS NOT NULL THEN 'campaign'
        WHEN p.referred_by_patient_id IS NOT NULL THEN 'referral'
        WHEN p.platform_id IS NOT NULL THEN 'organic'
        ELSE 'direct'
    END,
    acquisition_details = CASE
        WHEN p.campaign_id IS NOT NULL THEN 
            (SELECT jsonb_build_object(
                'campaign_id', mc.id,
                'campaign_name', mc.name
            )
            FROM marketing_campaigns mc
            WHERE mc.id = p.campaign_id)
        WHEN p.referred_by_patient_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'referrer_id', ref.id,
                'referrer_name', ref.first_name || ' ' || ref.last_name
            )
            FROM patients ref
            WHERE ref.id = p.referred_by_patient_id)
        WHEN p.platform_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'platform_id', plat.id,
                'platform_name', plat.display_name
            )
            FROM categories plat
            WHERE plat.id = p.platform_id)
        ELSE '{}'::JSONB
    END
WHERE p.acquisition_type IS NULL;

-- 5. Crear vista unificada simple
CREATE OR REPLACE VIEW patient_acquisition_unified AS
SELECT 
    p.id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.created_at as acquisition_date,
    
    -- Tipo de adquisición
    COALESCE(p.acquisition_type, 'direct') as acquisition_type,
    
    -- Nombre del origen
    CASE 
        WHEN p.campaign_id IS NOT NULL THEN 
            (SELECT mc.name FROM marketing_campaigns mc WHERE mc.id = p.campaign_id)
        WHEN p.referred_by_patient_id IS NOT NULL THEN 
            (SELECT ref.first_name || ' ' || ref.last_name FROM patients ref WHERE ref.id = p.referred_by_patient_id)
        WHEN p.platform_id IS NOT NULL THEN 
            (SELECT plat.display_name FROM categories plat WHERE plat.id = p.platform_id)
        ELSE 'Visita Directa'
    END as source_display_name,
    
    -- Detalles
    COALESCE(p.acquisition_details, '{}'::JSONB) as details,
    
    -- IDs para joins
    p.campaign_id,
    p.referred_by_patient_id,
    p.platform_id
    
FROM patients p;

-- 6. Vista simple de estadísticas
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
    pau.clinic_id,
    pau.acquisition_type,
    pau.source_display_name,
    COUNT(*) as patient_count,
    MIN(pau.acquisition_date) as first_patient_date,
    MAX(pau.acquisition_date) as last_patient_date
FROM patient_acquisition_unified pau
GROUP BY pau.clinic_id, pau.acquisition_type, pau.source_display_name;

-- 7. Vista simple de reporte
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    pau.clinic_id,
    pau.acquisition_type,
    DATE_TRUNC('month', pau.acquisition_date) as month,
    COUNT(*) as new_patients
FROM patient_acquisition_unified pau
GROUP BY pau.clinic_id, pau.acquisition_type, DATE_TRUNC('month', pau.acquisition_date);

-- 8. Vista simple de campañas
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    mc.id,
    mc.clinic_id,
    mc.name as campaign_name,
    mc.is_active,
    mc.start_date,
    mc.end_date,
    COUNT(DISTINCT p.id) as total_patients,
    MIN(p.created_at) as first_patient_date,
    MAX(p.created_at) as last_patient_date
FROM marketing_campaigns mc
LEFT JOIN patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.clinic_id, mc.name, mc.is_active, mc.start_date, mc.end_date;

-- 9. Índices básicos
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_type ON patients(acquisition_type);
CREATE INDEX IF NOT EXISTS idx_patients_campaign ON patients(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_referrer ON patients(referred_by_patient_id) WHERE referred_by_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_platform ON patients(platform_id) WHERE platform_id IS NOT NULL;

-- 10. Trigger simple de validación
CREATE OR REPLACE FUNCTION validate_patient_acquisition()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar acquisition_type automáticamente
    NEW.acquisition_type = CASE
        WHEN NEW.campaign_id IS NOT NULL THEN 'campaign'
        WHEN NEW.referred_by_patient_id IS NOT NULL THEN 'referral'
        WHEN NEW.platform_id IS NOT NULL THEN 'organic'
        ELSE 'direct'
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_patient_acquisition_trigger ON patients;
CREATE TRIGGER validate_patient_acquisition_trigger
    BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION validate_patient_acquisition();

-- 11. Verificación final
SELECT 
    'Migración completada (versión mínima)' as status,
    COUNT(*) as total_patients,
    COUNT(CASE WHEN acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN acquisition_type = 'direct' THEN 1 END) as direct_visits
FROM patients;