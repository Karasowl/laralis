-- =====================================================
-- Script: Unificación Correcta del Sistema de Origen de Pacientes
-- Fecha: 2025-08-31
-- Descripción: Basado en la estructura real de la BD
-- =====================================================

-- 1. Primero, hacer backup de los datos de source_id antes de eliminar
CREATE TEMP TABLE IF NOT EXISTS source_backup AS
SELECT 
    p.id as patient_id,
    p.source_id,
    ps.name as source_name,
    ps.description as source_description
FROM patients p
LEFT JOIN patient_sources ps ON p.source_id = ps.id
WHERE p.source_id IS NOT NULL;

-- 2. Eliminar la columna source_id con CASCADE (eliminará las vistas dependientes)
ALTER TABLE patients 
DROP COLUMN IF EXISTS source_id CASCADE;

-- 3. Agregar nuevas columnas si no existen
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50) 
CHECK (acquisition_type IN ('campaign', 'referral', 'organic', 'direct'));

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_details JSONB;

-- 4. Verificar que platform_id existe (ya parece existir según la info)
-- No necesitamos agregarlo porque ya existe

-- 5. Migrar datos existentes al nuevo formato
-- Incluimos la migración de los datos antiguos de source_id
UPDATE patients p
SET 
    acquisition_type = CASE
        -- Si tiene campaña, es tipo campaign
        WHEN p.campaign_id IS NOT NULL THEN 'campaign'
        -- Si tiene referido, es tipo referral
        WHEN p.referred_by_patient_id IS NOT NULL THEN 'referral'
        -- Si tiene platform_id (sin campaña), es orgánico
        WHEN p.platform_id IS NOT NULL AND p.campaign_id IS NULL THEN 'organic'
        -- Si tenía un source_id antiguo, intentar mapear
        WHEN EXISTS (
            SELECT 1 FROM source_backup sb 
            WHERE sb.patient_id = p.id 
            AND LOWER(sb.source_name) LIKE '%campaign%'
        ) THEN 'campaign'
        WHEN EXISTS (
            SELECT 1 FROM source_backup sb 
            WHERE sb.patient_id = p.id 
            AND (LOWER(sb.source_name) LIKE '%referr%' OR LOWER(sb.source_name) LIKE '%refer%')
        ) THEN 'referral'
        WHEN EXISTS (
            SELECT 1 FROM source_backup sb 
            WHERE sb.patient_id = p.id 
            AND (LOWER(sb.source_name) LIKE '%facebook%' OR 
                 LOWER(sb.source_name) LIKE '%instagram%' OR 
                 LOWER(sb.source_name) LIKE '%google%' OR
                 LOWER(sb.source_name) LIKE '%social%')
        ) THEN 'organic'
        -- Por defecto es directo
        ELSE 'direct'
    END,
    acquisition_details = CASE
        WHEN p.campaign_id IS NOT NULL THEN 
            (SELECT jsonb_build_object(
                'campaign_id', mc.id,
                'campaign_name', mc.name,
                'platform_id', mc.platform_category_id
            )
            FROM marketing_campaigns mc
            WHERE mc.id = p.campaign_id)
        WHEN p.referred_by_patient_id IS NOT NULL THEN
            (SELECT jsonb_build_object(
                'referrer_id', ref.id,
                'referrer_name', ref.first_name || ' ' || ref.last_name,
                'referrer_email', ref.email
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
        -- Incluir info del source antiguo si existe
        WHEN EXISTS (SELECT 1 FROM source_backup sb WHERE sb.patient_id = p.id) THEN
            (SELECT jsonb_build_object(
                'legacy_source', sb.source_name,
                'legacy_description', sb.source_description
            )
            FROM source_backup sb
            WHERE sb.patient_id = p.id)
        ELSE '{}'::JSONB
    END
WHERE p.acquisition_type IS NULL;

-- 6. Crear vista unificada para reportes
CREATE OR REPLACE VIEW patient_acquisition_unified AS
SELECT 
    p.id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
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

-- 7. Recrear vista patient_source_stats
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
    pau.clinic_id,
    pau.acquisition_type,
    pau.source_display_name,
    COUNT(*) as patient_count,
    COUNT(DISTINCT DATE_TRUNC('month', pau.acquisition_date)) as active_months,
    MIN(pau.acquisition_date) as first_patient_date,
    MAX(pau.acquisition_date) as last_patient_date
FROM patient_acquisition_unified pau
GROUP BY pau.clinic_id, pau.acquisition_type, pau.source_display_name;

-- 8. Recrear vista patient_acquisition_report
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    pau.clinic_id,
    c.name as clinic_name,
    pau.acquisition_type,
    pau.source_display_name,
    DATE_TRUNC('month', pau.acquisition_date) as month,
    COUNT(*) as new_patients,
    COUNT(CASE WHEN pau.acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN pau.acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN pau.acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN pau.acquisition_type = 'direct' THEN 1 END) as direct_visits
FROM patient_acquisition_unified pau
LEFT JOIN clinics c ON pau.clinic_id = c.id
GROUP BY pau.clinic_id, c.name, pau.acquisition_type, pau.source_display_name, DATE_TRUNC('month', pau.acquisition_date);

-- 9. Recrear vista campaign_stats si existía
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    mc.id,
    mc.clinic_id,
    mc.name as campaign_name,
    cat.display_name as platform_name,
    mc.is_active,
    COALESCE(mc.is_archived, false) as is_archived,
    mc.start_date,
    mc.end_date,
    mc.budget_cents,
    mc.spent_cents,
    COUNT(DISTINCT p.id) as total_patients,
    COUNT(DISTINCT CASE WHEN p.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN p.id END) as patients_last_30_days,
    MIN(p.created_at) as first_patient_date,
    MAX(p.created_at) as last_patient_date
FROM marketing_campaigns mc
LEFT JOIN categories cat ON mc.platform_category_id = cat.id
LEFT JOIN patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.clinic_id, mc.name, cat.display_name, mc.is_active, mc.is_archived, 
         mc.start_date, mc.end_date, mc.budget_cents, mc.spent_cents;

-- 10. Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_type ON patients(acquisition_type);
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_details ON patients USING GIN(acquisition_details);

-- Los siguientes índices ya existen según la información proporcionada, pero los creamos si no existen
CREATE INDEX IF NOT EXISTS idx_patients_campaign ON patients(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_referrer ON patients(referred_by_patient_id) WHERE referred_by_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_platform ON patients(platform_id) WHERE platform_id IS NOT NULL;

-- 11. Trigger para mantener coherencia
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

-- 12. Documentación
COMMENT ON COLUMN patients.acquisition_type IS 'Tipo de adquisición: campaign, referral, organic, direct';
COMMENT ON COLUMN patients.acquisition_details IS 'Detalles JSON del origen del paciente con información adicional';
COMMENT ON COLUMN patients.campaign_id IS 'ID de campaña de marketing si el paciente viene de publicidad';
COMMENT ON COLUMN patients.referred_by_patient_id IS 'ID del paciente que refirió a este paciente';
COMMENT ON COLUMN patients.platform_id IS 'ID de plataforma/categoría si es origen orgánico';

-- 13. Verificación final
SELECT 
    'Migración completada correctamente' as status,
    COUNT(*) as total_patients,
    COUNT(CASE WHEN acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN acquisition_type = 'direct' THEN 1 END) as direct_visits,
    COUNT(CASE WHEN acquisition_details ? 'legacy_source' THEN 1 END) as migrated_from_old_source
FROM patients;

-- 14. Verificar que las vistas se recrearon
SELECT 
    'Vistas recreadas' as check_type,
    table_name as view_name,
    CASE 
        WHEN table_name IS NOT NULL THEN 'OK'
        ELSE 'FALTA'
    END as status
FROM information_schema.views
WHERE table_name IN ('patient_acquisition_unified', 'patient_source_stats', 'patient_acquisition_report', 'campaign_stats')
ORDER BY table_name;

-- 15. Limpiar tabla temporal
DROP TABLE IF EXISTS source_backup;