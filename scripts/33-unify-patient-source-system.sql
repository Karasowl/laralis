-- =====================================================
-- Script: Unificar Sistema de Origen de Pacientes
-- Fecha: 2025-08-31
-- Descripción: Elimina redundancia entre source_id y campaign_id
-- unificando todo en un sistema coherente de origen
-- =====================================================

-- 1. Primero, hacer backup de datos actuales
CREATE TEMP TABLE patients_backup AS 
SELECT id, source_id, campaign_id, referred_by_patient_id, platform_id 
FROM patients;

-- 2. Eliminar la columna source_id redundante de patients
-- (mantenemos campaign_id, referred_by_patient_id, y platform_id para casos específicos)
ALTER TABLE patients 
DROP COLUMN IF EXISTS source_id;

-- 3. Agregar nueva columna para tipo de origen
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50) 
CHECK (acquisition_type IN ('campaign', 'referral', 'organic', 'direct'));

-- 4. Agregar columna para detalles adicionales del origen
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS acquisition_details JSONB;

-- 5. Crear función para obtener el origen del paciente de forma inteligente
CREATE OR REPLACE FUNCTION get_patient_acquisition_source(
    p_campaign_id UUID,
    p_referred_by_patient_id UUID,
    p_platform_id UUID,
    p_acquisition_type VARCHAR(50)
) RETURNS TABLE (
    source_type TEXT,
    source_name TEXT,
    source_details JSONB
) AS $$
BEGIN
    -- Si hay una campaña, ese es el origen principal
    IF p_campaign_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'campaign'::TEXT as source_type,
            mc.name::TEXT as source_name,
            jsonb_build_object(
                'campaign_id', mc.id,
                'campaign_name', mc.name,
                'platform', plat.display_name,
                'start_date', mc.start_date,
                'end_date', mc.end_date
            ) as source_details
        FROM marketing_campaigns mc
        LEFT JOIN categories plat ON mc.platform_category_id = plat.id
        WHERE mc.id = p_campaign_id;
        
    -- Si hay un paciente que refirió
    ELSIF p_referred_by_patient_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'referral'::TEXT as source_type,
            (ref.first_name || ' ' || ref.last_name)::TEXT as source_name,
            jsonb_build_object(
                'referrer_id', ref.id,
                'referrer_name', ref.first_name || ' ' || ref.last_name,
                'referrer_phone', ref.phone
            ) as source_details
        FROM patients ref
        WHERE ref.id = p_referred_by_patient_id;
        
    -- Si hay una plataforma orgánica
    ELSIF p_platform_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'organic'::TEXT as source_type,
            plat.display_name::TEXT as source_name,
            jsonb_build_object(
                'platform_id', plat.id,
                'platform_name', plat.display_name
            ) as source_details
        FROM categories plat
        WHERE plat.id = p_platform_id;
        
    -- Si no hay nada, es directo
    ELSE
        RETURN QUERY
        SELECT 
            'direct'::TEXT as source_type,
            'Visita Directa'::TEXT as source_name,
            '{}'::JSONB as source_details;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Migrar datos existentes al nuevo formato
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
                'platform', cat.display_name
            )
            FROM marketing_campaigns mc
            LEFT JOIN categories cat ON mc.platform_category_id = cat.id
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

-- 7. Crear vista unificada para reportes
CREATE OR REPLACE VIEW patient_acquisition_unified AS
SELECT 
    p.id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.created_at as acquisition_date,
    
    -- Tipo de adquisición
    COALESCE(p.acquisition_type, 
        CASE 
            WHEN p.campaign_id IS NOT NULL THEN 'campaign'
            WHEN p.referred_by_patient_id IS NOT NULL THEN 'referral'
            WHEN p.platform_id IS NOT NULL THEN 'organic'
            ELSE 'direct'
        END
    ) as acquisition_type,
    
    -- Nombre del origen
    CASE 
        WHEN p.campaign_id IS NOT NULL THEN mc.name
        WHEN p.referred_by_patient_id IS NOT NULL THEN ref.first_name || ' ' || ref.last_name
        WHEN p.platform_id IS NOT NULL THEN plat.display_name
        ELSE 'Visita Directa'
    END as source_display_name,
    
    -- Detalles completos
    COALESCE(p.acquisition_details,
        CASE 
            WHEN p.campaign_id IS NOT NULL THEN 
                jsonb_build_object(
                    'campaign_id', mc.id,
                    'campaign_name', mc.name,
                    'platform', plat_camp.display_name,
                    'campaign_cost', mc.total_cost_cents,
                    'campaign_status', mc.status
                )
            WHEN p.referred_by_patient_id IS NOT NULL THEN
                jsonb_build_object(
                    'referrer_id', ref.id,
                    'referrer_name', ref.first_name || ' ' || ref.last_name,
                    'referrer_email', ref.email
                )
            WHEN p.platform_id IS NOT NULL THEN
                jsonb_build_object(
                    'platform_id', plat.id,
                    'platform_name', plat.display_name
                )
            ELSE '{}'::JSONB
        END
    ) as details,
    
    -- IDs para joins
    p.campaign_id,
    p.referred_by_patient_id,
    p.platform_id
    
FROM patients p
LEFT JOIN marketing_campaigns mc ON p.campaign_id = mc.id
LEFT JOIN categories plat_camp ON mc.platform_category_id = plat_camp.id
LEFT JOIN patients ref ON p.referred_by_patient_id = ref.id
LEFT JOIN categories plat ON p.platform_id = plat.id;

-- 8. Crear función para estadísticas de adquisición
CREATE OR REPLACE FUNCTION get_acquisition_stats(
    p_clinic_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
    acquisition_type VARCHAR(50),
    source_name TEXT,
    patient_count BIGINT,
    percentage NUMERIC(5,2),
    avg_ltv_cents INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH patient_stats AS (
        SELECT 
            pau.acquisition_type,
            pau.source_display_name,
            COUNT(*) as count,
            AVG(
                COALESCE(
                    (SELECT SUM(t.price_cents) 
                     FROM treatments t 
                     WHERE t.patient_id = pau.id),
                    0
                )
            ) as avg_ltv
        FROM patient_acquisition_unified pau
        WHERE pau.clinic_id = p_clinic_id
        AND (p_start_date IS NULL OR pau.acquisition_date >= p_start_date)
        AND (p_end_date IS NULL OR pau.acquisition_date <= p_end_date)
        GROUP BY pau.acquisition_type, pau.source_display_name
    ),
    total_patients AS (
        SELECT SUM(count) as total FROM patient_stats
    )
    SELECT 
        ps.acquisition_type,
        ps.source_display_name::TEXT,
        ps.count,
        ROUND((ps.count::NUMERIC / tp.total * 100), 2) as percentage,
        ps.avg_ltv::INTEGER as avg_ltv_cents
    FROM patient_stats ps
    CROSS JOIN total_patients tp
    ORDER BY ps.count DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_type ON patients(acquisition_type);
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_details ON patients USING GIN(acquisition_details);

-- 10. Trigger para validar coherencia de datos
CREATE OR REPLACE FUNCTION validate_patient_acquisition()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo puede tener un tipo de origen a la vez
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
                'platform', cat.display_name
            )
            FROM marketing_campaigns mc
            LEFT JOIN categories cat ON mc.platform_category_id = cat.id
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

-- 11. Comentarios para documentación
COMMENT ON COLUMN patients.acquisition_type IS 'Tipo de adquisición: campaign, referral, organic, direct';
COMMENT ON COLUMN patients.acquisition_details IS 'Detalles JSON del origen del paciente';
COMMENT ON COLUMN patients.campaign_id IS 'ID de campaña si viene de publicidad';
COMMENT ON COLUMN patients.referred_by_patient_id IS 'ID del paciente que lo refirió';
COMMENT ON COLUMN patients.platform_id IS 'ID de plataforma si es orgánico (sin campaña)';

-- Verificación final
SELECT 
    'Migración completada' as status,
    COUNT(*) as total_patients,
    COUNT(CASE WHEN acquisition_type = 'campaign' THEN 1 END) as from_campaigns,
    COUNT(CASE WHEN acquisition_type = 'referral' THEN 1 END) as from_referrals,
    COUNT(CASE WHEN acquisition_type = 'organic' THEN 1 END) as from_organic,
    COUNT(CASE WHEN acquisition_type = 'direct' THEN 1 END) as direct_visits
FROM patients;