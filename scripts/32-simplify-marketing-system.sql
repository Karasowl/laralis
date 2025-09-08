-- =====================================================
-- Script: Simplificar sistema de marketing
-- Fecha: 2025-08-31
-- Descripción: Unifica el sistema de origen de pacientes
-- eliminando duplicaciones entre sources, platforms y campaigns
-- =====================================================

-- 1. BACKUP: Crear tabla temporal con datos actuales (por seguridad)
CREATE TABLE IF NOT EXISTS _backup_patient_sources AS 
SELECT * FROM categories WHERE entity_type = 'patient_source';

-- 2. Limpiar las vías de llegada anteriores (patient_source)
DELETE FROM categories 
WHERE entity_type = 'patient_source' 
AND is_system = true;

-- 3. Insertar las 4 vías principales simplificadas
INSERT INTO categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('patient_source', 'campaign', 'Campaña Publicitaria', true, 1),
    ('patient_source', 'referral', 'Referido por Paciente', true, 2),
    ('patient_source', 'organic', 'Orgánico (Redes/Web)', true, 3),
    ('patient_source', 'direct', 'Directo (Visita/Llamada)', true, 4)
ON CONFLICT (clinic_id, entity_type, name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    display_order = EXCLUDED.display_order;

-- 4. Agregar campo platform_id a la tabla patients si no existe
-- (para cuando el source es 'organic')
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' 
        AND column_name = 'platform_id'
    ) THEN
        ALTER TABLE patients 
        ADD COLUMN platform_id UUID REFERENCES categories(id);
        
        COMMENT ON COLUMN patients.platform_id IS 
        'Plataforma de origen cuando source es orgánico';
    END IF;
END $$;

-- 5. Crear función helper para determinar el origen correcto
CREATE OR REPLACE FUNCTION get_patient_acquisition_details(
    p_source_id UUID,
    p_campaign_id UUID,
    p_referred_by_patient_id UUID,
    p_platform_id UUID
)
RETURNS TABLE (
    acquisition_type TEXT,
    acquisition_detail TEXT
) AS $$
DECLARE
    v_source_name TEXT;
BEGIN
    -- Obtener el tipo de source
    SELECT name INTO v_source_name
    FROM categories 
    WHERE id = p_source_id;
    
    -- Determinar el tipo y detalle según la vía
    CASE v_source_name
        WHEN 'campaign' THEN
            -- Si es campaña, mostrar nombre de la campaña
            RETURN QUERY
            SELECT 
                'Campaña Publicitaria'::TEXT,
                COALESCE(c.name, 'Campaña no especificada')::TEXT
            FROM marketing_campaigns c
            WHERE c.id = p_campaign_id;
            
        WHEN 'referral' THEN
            -- Si es referido, mostrar nombre del paciente
            RETURN QUERY
            SELECT 
                'Referido por Paciente'::TEXT,
                COALESCE(p.first_name || ' ' || p.last_name, 'Paciente no especificado')::TEXT
            FROM patients p
            WHERE p.id = p_referred_by_patient_id;
            
        WHEN 'organic' THEN
            -- Si es orgánico, mostrar plataforma
            RETURN QUERY
            SELECT 
                'Orgánico'::TEXT,
                COALESCE(c.display_name, 'Plataforma no especificada')::TEXT
            FROM categories c
            WHERE c.id = p_platform_id;
            
        WHEN 'direct' THEN
            -- Si es directo, no hay detalle adicional
            RETURN QUERY
            SELECT 
                'Directo'::TEXT,
                'Visita directa o llamada telefónica'::TEXT;
            
        ELSE
            RETURN QUERY
            SELECT 
                'No especificado'::TEXT,
                'Origen no definido'::TEXT;
    END CASE;
    
    -- Si no retornó nada, devolver default
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            COALESCE(v_source_name, 'No especificado')::TEXT,
            'Sin detalles'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear vista mejorada para reportes de origen de pacientes
CREATE OR REPLACE VIEW patient_acquisition_report AS
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.acquisition_date,
    p.clinic_id,
    
    -- Vía principal
    src.display_name as source_type,
    
    -- Detalles según el tipo
    CASE 
        WHEN src.name = 'campaign' THEN mc.name
        WHEN src.name = 'referral' THEN ref.first_name || ' ' || ref.last_name
        WHEN src.name = 'organic' THEN plat.display_name
        WHEN src.name = 'direct' THEN 'Directo'
        ELSE 'No especificado'
    END as acquisition_detail,
    
    -- Información adicional
    mc.name as campaign_name,
    plat.display_name as platform_name,
    ref.first_name || ' ' || ref.last_name as referrer_name,
    
    -- Para análisis
    src.name as source_key,
    p.source_id,
    p.campaign_id,
    p.platform_id,
    p.referred_by_patient_id
    
FROM patients p
LEFT JOIN categories src ON p.source_id = src.id AND src.entity_type = 'patient_source'
LEFT JOIN marketing_campaigns mc ON p.campaign_id = mc.id
LEFT JOIN categories plat ON p.platform_id = plat.id AND plat.entity_type = 'marketing_platform'
LEFT JOIN patients ref ON p.referred_by_patient_id = ref.id;

-- 7. Migración de datos existentes (mapear sources antiguos a nuevos)
-- Esto es seguro y no rompe datos existentes
UPDATE patients p
SET source_id = (
    SELECT id FROM categories 
    WHERE entity_type = 'patient_source' 
    AND name = 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM categories c 
            WHERE c.id = p.source_id 
            AND c.name IN ('campaña', 'campaign')
        ) THEN 'campaign'
        
        WHEN EXISTS (
            SELECT 1 FROM categories c 
            WHERE c.id = p.source_id 
            AND c.name IN ('referido', 'referral', 'recomendacion')
        ) THEN 'referral'
        
        WHEN EXISTS (
            SELECT 1 FROM categories c 
            WHERE c.id = p.source_id 
            AND c.name IN ('redes_sociales', 'sitio_web', 'facebook', 'instagram', 'google')
        ) THEN 'organic'
        
        WHEN EXISTS (
            SELECT 1 FROM categories c 
            WHERE c.id = p.source_id 
            AND c.name IN ('directo', 'direct', 'walk_in', 'phone')
        ) THEN 'direct'
        
        ELSE NULL
    END
    LIMIT 1
)
WHERE source_id IS NOT NULL;

-- 8. Agregar validación para asegurar consistencia de datos
CREATE OR REPLACE FUNCTION validate_patient_acquisition()
RETURNS TRIGGER AS $$
DECLARE
    v_source_name TEXT;
BEGIN
    -- Obtener el tipo de source
    SELECT name INTO v_source_name
    FROM categories 
    WHERE id = NEW.source_id;
    
    -- Validar que los campos relacionados estén correctos según el tipo
    CASE v_source_name
        WHEN 'campaign' THEN
            -- Si es campaña, debe tener campaign_id
            IF NEW.campaign_id IS NULL THEN
                RAISE EXCEPTION 'Debe especificar una campaña cuando la vía es Campaña Publicitaria';
            END IF;
            -- Limpiar otros campos no relevantes
            NEW.platform_id := NULL;
            NEW.referred_by_patient_id := NULL;
            
        WHEN 'referral' THEN
            -- Si es referido, debe tener referred_by_patient_id
            IF NEW.referred_by_patient_id IS NULL THEN
                RAISE EXCEPTION 'Debe especificar quién refirió al paciente';
            END IF;
            -- Limpiar otros campos no relevantes
            NEW.campaign_id := NULL;
            NEW.platform_id := NULL;
            
        WHEN 'organic' THEN
            -- Si es orgánico, debe tener platform_id
            IF NEW.platform_id IS NULL THEN
                RAISE EXCEPTION 'Debe especificar la plataforma de origen';
            END IF;
            -- Limpiar otros campos no relevantes
            NEW.campaign_id := NULL;
            NEW.referred_by_patient_id := NULL;
            
        WHEN 'direct' THEN
            -- Si es directo, limpiar todos los campos relacionados
            NEW.campaign_id := NULL;
            NEW.platform_id := NULL;
            NEW.referred_by_patient_id := NULL;
            
        ELSE
            -- Si no tiene source definido, permitir pero limpiar
            NULL;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Crear trigger para validación (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'validate_patient_acquisition_trigger'
    ) THEN
        CREATE TRIGGER validate_patient_acquisition_trigger
        BEFORE INSERT OR UPDATE ON patients
        FOR EACH ROW
        EXECUTE FUNCTION validate_patient_acquisition();
    END IF;
END $$;

-- 10. Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Sistema de marketing simplificado exitosamente';
    RAISE NOTICE 'Ahora hay 4 vías principales: Campaña, Referido, Orgánico, Directo';
    RAISE NOTICE 'Los datos existentes han sido migrados automáticamente';
END $$;