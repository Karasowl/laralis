-- =====================================================
-- MIGRACIÓN FINAL - BASADA EN ESTRUCTURA REAL
-- Fecha: 2025-09-01
-- =====================================================

-- 1. Backup de datos antes de migrar
CREATE TEMP TABLE IF NOT EXISTS source_backup AS
SELECT 
    p.id as patient_id,
    p.source_id,
    ps.name as source_name,
    ps.description as source_description
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id;

-- 2. Eliminar source_id con CASCADE (eliminará vistas dependientes)
ALTER TABLE patients 
DROP COLUMN source_id CASCADE;

-- 3. Agregar nuevas columnas (NO existen actualmente)
ALTER TABLE patients 
ADD COLUMN acquisition_type VARCHAR(50) 
CHECK (acquisition_type IN ('campaign', 'referral', 'organic', 'direct'));

ALTER TABLE patients 
ADD COLUMN acquisition_details JSONB;

-- 4. Migrar datos existentes
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
                'campaign_name', mc.name,
                'campaign_code', mc.code,
                'platform_id', mc.platform_category_id
            )
            FROM marketing_campaigns mc
            WHERE mc.id = p.campaign_id)
        WHEN p.referred_by_patient_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'referrer_id', ref.id,
                'referrer_name', ref.first_name || ' ' || ref.last_name,
                'referrer_email', ref.email,
                'referrer_phone', ref.phone
            )
            FROM patients ref
            WHERE ref.id = p.referred_by_patient_id)
        WHEN p.platform_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'platform_id', plat.id,
                'platform_name', plat.display_name,
                'platform_type', plat.entity_type
            )
            FROM categories plat
            WHERE plat.id = p.platform_id)
        ELSE 
            -- Incluir info del source antiguo si existía
            COALESCE(
                (SELECT jsonb_build_object(
                    'legacy_source', sb.source_name,
                    'legacy_description', sb.source_description
                )
                FROM source_backup sb
                WHERE sb.patient_id = p.id),
                '{}'::JSONB
            )
    END
WHERE p.acquisition_type IS NULL;

-- 5. Vista unificada para reportes
CREATE OR REPLACE VIEW patient_acquisition_unified AS
SELECT 
    p.id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.created_at,
    p.first_visit_date,
    
    -- Tipo de adquisición
    COALESCE(p.acquisition_type, 'direct') as acquisition_type,
    
    -- Nombre del origen
    CASE 
        WHEN p.campaign_id IS NOT NULL THEN 
            (SELECT mc.name FROM marketing_campaigns mc WHERE mc.id = p.campaign_id)
        WHEN p.referred_by_patient_id IS NOT NULL THEN 
            (SELECT ref.first_name || ' ' || ref.last_name FROM patients ref WHERE ref.id = p.referred_by_patient_id)
        WHEN p.platform_id IS NOT NULL THEN 
            (SELECT cat.display_name FROM categories cat WHERE cat.id = p.platform_id)
        ELSE 'Visita Directa'
    END as source_display_name,
    
    -- Detalles
    COALESCE(p.acquisition_details, '{}'::JSONB) as details,
    
    -- IDs para joins
    p.campaign_id,
    p.referred_by_patient_id,
    p.platform_id
    
FROM patients p;

-- 6. Recrear vista patient_source_stats
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
    pau.clinic_id,
    pau.acquisition_type,
    pau.source_display_name,
    COUNT(*) as patient_count,
    COUNT(DISTINCT DATE_TRUNC('month', pau.created_at)) as active_months,
    MIN(pau.created_at) as first_patient_date,
    MAX(pau.created_at) as last_patient_date
FROM patient_acquisition_unified pau
GROUP BY pau.clinic_id, pau.acquisition_type, pau.source_display_name;

-- 7. Recrear vista patient_acquisition_report
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    pau.clinic_id,
    c.name as clinic_name,
    pau.acquisition_type,
    pau.source_display_name,
    DATE_TRUNC('month', pau.created_at) as month,
    COUNT(*) as new_patients,
    COUNT(CASE WHEN pau.acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN pau.acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN pau.acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN pau.acquisition_type = 'direct' THEN 1 END) as direct_visits
FROM patient_acquisition_unified pau
LEFT JOIN clinics c ON pau.clinic_id = c.id
GROUP BY pau.clinic_id, c.name, pau.acquisition_type, pau.source_display_name, DATE_TRUNC('month', pau.created_at);

-- 8. Recrear vista campaign_stats (con columnas que SÍ existen)
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    mc.id,
    mc.clinic_id,
    mc.name as campaign_name,
    mc.code as campaign_code,
    cat.display_name as platform_name,
    mc.is_active,
    mc.is_archived,
    mc.created_at,
    mc.updated_at,
    COUNT(DISTINCT p.id) as total_patients,
    COUNT(DISTINCT CASE WHEN p.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN p.id END) as patients_last_30_days,
    MIN(p.created_at) as first_patient_date,
    MAX(p.created_at) as last_patient_date
FROM marketing_campaigns mc
LEFT JOIN categories cat ON mc.platform_category_id = cat.id
LEFT JOIN patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.clinic_id, mc.name, mc.code, cat.display_name, 
         mc.is_active, mc.is_archived, mc.created_at, mc.updated_at;

-- 9. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_type ON patients(acquisition_type);
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_details ON patients USING GIN(acquisition_details);
-- Los siguientes ya existen pero los creamos si no
CREATE INDEX IF NOT EXISTS idx_patients_campaign ON patients(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_referrer ON patients(referred_by_patient_id) WHERE referred_by_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_platform ON patients(platform_id) WHERE platform_id IS NOT NULL;

-- 10. Trigger para mantener coherencia
CREATE OR REPLACE FUNCTION validate_patient_acquisition()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo puede tener un tipo de origen principal
    IF (
        (NEW.campaign_id IS NOT NULL)::INT +
        (NEW.referred_by_patient_id IS NOT NULL)::INT +
        (NEW.platform_id IS NOT NULL AND NEW.campaign_id IS NULL)::INT
    ) > 1 THEN
        RAISE EXCEPTION 'Un paciente solo puede tener un tipo de origen: campaña, referido, o plataforma orgánica';
    END IF;
    
    -- Actualizar acquisition_type automáticamente
    NEW.acquisition_type = CASE
        WHEN NEW.campaign_id IS NOT NULL THEN 'campaign'
        WHEN NEW.referred_by_patient_id IS NOT NULL THEN 'referral'
        WHEN NEW.platform_id IS NOT NULL THEN 'organic'
        ELSE 'direct'
    END;
    
    -- Actualizar acquisition_details
    NEW.acquisition_details = CASE
        WHEN NEW.campaign_id IS NOT NULL THEN 
            (SELECT jsonb_build_object(
                'campaign_id', mc.id,
                'campaign_name', mc.name,
                'campaign_code', mc.code,
                'platform_id', mc.platform_category_id
            )
            FROM marketing_campaigns mc
            WHERE mc.id = NEW.campaign_id)
        WHEN NEW.referred_by_patient_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'referrer_id', ref.id,
                'referrer_name', ref.first_name || ' ' || ref.last_name
            )
            FROM patients ref
            WHERE ref.id = NEW.referred_by_patient_id)
        WHEN NEW.platform_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'platform_id', plat.id,
                'platform_name', plat.display_name
            )
            FROM categories plat
            WHERE plat.id = NEW.platform_id)
        ELSE '{}'::JSONB
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_patient_acquisition_trigger ON patients;
CREATE TRIGGER validate_patient_acquisition_trigger
    BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION validate_patient_acquisition();

-- 11. Documentación
COMMENT ON COLUMN patients.acquisition_type IS 'Tipo de adquisición: campaign, referral, organic, direct';
COMMENT ON COLUMN patients.acquisition_details IS 'Detalles JSON del origen del paciente';
COMMENT ON COLUMN patients.campaign_id IS 'ID de campaña si viene de publicidad';
COMMENT ON COLUMN patients.referred_by_patient_id IS 'ID del paciente que lo refirió';
COMMENT ON COLUMN patients.platform_id IS 'ID de plataforma si es orgánico';

-- 12. Verificación final
SELECT 
    'Migración completada exitosamente' as status,
    COUNT(*) as total_patients,
    COUNT(CASE WHEN acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN acquisition_type = 'direct' THEN 1 END) as direct_visits
FROM patients;

-- 13. Limpiar tabla temporal
DROP TABLE IF EXISTS source_backup;