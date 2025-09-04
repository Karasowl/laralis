-- =====================================================
-- MIGRACIÓN BASADA EN ESTRUCTURA CONOCIDA
-- Basado en los foreign keys que SÍ sabemos que existen
-- =====================================================

-- SABEMOS QUE EXISTEN ESTOS FOREIGN KEYS:
-- patients.source_id -> patient_sources.id
-- patients.campaign_id -> marketing_campaigns.id  
-- patients.platform_id -> categories.id
-- patients.referred_by_patient_id -> patients.id
-- patients.clinic_id -> clinics.id

-- 1. Eliminar source_id (sabemos que existe)
ALTER TABLE patients 
DROP COLUMN source_id CASCADE;

-- 2. Agregar nuevas columnas
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50);

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_details JSONB;

-- 3. Migración basada en lo que sabemos que existe
UPDATE patients
SET 
    acquisition_type = CASE
        WHEN campaign_id IS NOT NULL THEN 'campaign'
        WHEN referred_by_patient_id IS NOT NULL THEN 'referral' 
        WHEN platform_id IS NOT NULL THEN 'organic'
        ELSE 'direct'
    END,
    acquisition_details = jsonb_build_object(
        'migrated_at', NOW(),
        'has_campaign', campaign_id IS NOT NULL,
        'has_referrer', referred_by_patient_id IS NOT NULL,
        'has_platform', platform_id IS NOT NULL
    )
WHERE acquisition_type IS NULL;

-- 4. Vista simple basada en campos conocidos
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
    p.platform_id,
    p.acquisition_details
FROM patients p;

-- 5. Vista de estadísticas simple
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
    clinic_id,
    acquisition_type,
    COUNT(*) as patient_count
FROM patient_acquisition_unified
GROUP BY clinic_id, acquisition_type;

-- 6. Vista de reporte simple
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    clinic_id,
    acquisition_type,
    DATE_TRUNC('month', acquisition_date) as month,
    COUNT(*) as new_patients
FROM patient_acquisition_unified
GROUP BY clinic_id, acquisition_type, DATE_TRUNC('month', acquisition_date);

-- 7. Vista de campañas con campos mínimos
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    mc.id,
    mc.name,
    COUNT(p.id) as total_patients
FROM marketing_campaigns mc
LEFT JOIN patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.name;

-- 8. Trigger simple
CREATE OR REPLACE FUNCTION validate_patient_acquisition()
RETURNS TRIGGER AS $$
BEGIN
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

-- 9. Verificación
SELECT 
    'Migración completada' as status,
    NOW() as completed_at;