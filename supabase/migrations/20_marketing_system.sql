-- Migration: Sistema de marketing con plataformas y campañas

-- 1. Agregar categorías de marketing platform al sistema si no existen
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, 1),
    ('marketing_platform', 'google_ads', 'Google Ads', true, 2),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, 3),
    ('marketing_platform', 'facebook_organic', 'Facebook Orgánico', true, 4),
    ('marketing_platform', 'instagram_organic', 'Instagram Orgánico', true, 5),
    ('marketing_platform', 'referral', 'Referidos', true, 6),
    ('marketing_platform', 'direct', 'Directo', true, 7),
    ('marketing_platform', 'other', 'Otro', true, 99)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- 2. Crear tabla de campañas de marketing
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    
    -- Información de la campaña
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100), -- Código interno de la campaña
    description TEXT,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,
    
    -- Fechas de campaña
    start_date DATE,
    end_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(clinic_id, platform_id, name),
    CHECK (NOT (is_active = true AND is_archived = true)) -- No puede estar activa y archivada
);

-- 3. Crear tabla de historial de estado de campañas
CREATE TABLE IF NOT EXISTS public.marketing_campaign_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    
    -- Cambio de estado
    from_status VARCHAR(50), -- 'active', 'inactive', 'archived'
    to_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255), -- Usuario que hizo el cambio (futuro)
    reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agregar campos de marketing a la tabla patients si no existen
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.marketing_campaigns(id),
ADD COLUMN IF NOT EXISTS referred_by_patient_id UUID REFERENCES public.patients(id),
ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255), -- Para casos legacy
ADD COLUMN IF NOT EXISTS acquisition_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Crear función trigger para historial de campañas
CREATE OR REPLACE FUNCTION track_campaign_status_change()
RETURNS TRIGGER AS $$
DECLARE
    old_status VARCHAR(50);
    new_status VARCHAR(50);
BEGIN
    -- Determinar estado anterior
    IF OLD IS NULL THEN
        old_status := NULL;
    ELSIF OLD.is_archived THEN
        old_status := 'archived';
    ELSIF OLD.is_active THEN
        old_status := 'active';
    ELSE
        old_status := 'inactive';
    END IF;
    
    -- Determinar estado nuevo
    IF NEW.is_archived THEN
        new_status := 'archived';
        NEW.archived_at := NOW();
    ELSIF NEW.is_active THEN
        new_status := 'active';
        -- Si se reactiva desde archivado
        IF OLD IS NOT NULL AND OLD.is_archived AND NOT NEW.is_archived THEN
            NEW.reactivated_at := NOW();
        END IF;
    ELSE
        new_status := 'inactive';
    END IF;
    
    -- Insertar en historial si cambió el estado
    IF old_status IS DISTINCT FROM new_status THEN
        INSERT INTO public.marketing_campaign_status_history (
            campaign_id, from_status, to_status, reason
        ) VALUES (
            NEW.id, old_status, new_status, 
            CASE 
                WHEN new_status = 'archived' THEN 'Campaign archived'
                WHEN new_status = 'active' AND old_status = 'archived' THEN 'Campaign reactivated'
                WHEN new_status = 'active' THEN 'Campaign activated'
                WHEN new_status = 'inactive' THEN 'Campaign deactivated'
                ELSE 'Status change'
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para el historial
DROP TRIGGER IF EXISTS marketing_campaign_status_trigger ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaign_status_trigger
    BEFORE INSERT OR UPDATE ON public.marketing_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION track_campaign_status_change();

-- 7. Crear trigger para updated_at en marketing_campaigns
DROP TRIGGER IF EXISTS update_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER update_marketing_campaigns_updated_at 
    BEFORE UPDATE ON public.marketing_campaigns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic ON public.marketing_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON public.marketing_campaigns(platform_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON public.marketing_campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_archived ON public.marketing_campaigns(is_archived);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_history_campaign ON public.marketing_campaign_status_history(campaign_id);
CREATE INDEX IF NOT EXISTS idx_patients_source ON public.patients(source_id);
CREATE INDEX IF NOT EXISTS idx_patients_campaign ON public.patients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_patients_referrer ON public.patients(referred_by_patient_id);

-- 9. Crear vista para estadísticas de campañas
CREATE OR REPLACE VIEW public.campaign_stats AS
SELECT 
    mc.id,
    mc.clinic_id,
    mc.name as campaign_name,
    c.display_name as platform_name,
    mc.is_active,
    mc.is_archived,
    mc.start_date,
    mc.end_date,
    COUNT(p.id) as total_patients,
    COUNT(CASE WHEN p.acquisition_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as patients_last_30_days,
    MIN(p.acquisition_date) as first_patient_date,
    MAX(p.acquisition_date) as last_patient_date,
    COUNT(DISTINCT p.referred_by_patient_id) as patients_from_referrals
FROM public.marketing_campaigns mc
LEFT JOIN public.categories c ON mc.platform_id = c.id
LEFT JOIN public.patients p ON mc.id = p.campaign_id
GROUP BY mc.id, mc.clinic_id, mc.name, c.display_name, mc.is_active, mc.is_archived, mc.start_date, mc.end_date;

-- 10. Crear vista para estadísticas de fuentes de pacientes
CREATE OR REPLACE VIEW public.patient_source_stats AS
SELECT 
    s.id as source_id,
    s.display_name as source_name,
    s.clinic_id,
    COUNT(p.id) as total_patients,
    COUNT(CASE WHEN p.acquisition_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as patients_last_30_days,
    COUNT(CASE WHEN t.id IS NOT NULL THEN 1 END) as patients_with_treatments,
    COUNT(DISTINCT CASE WHEN p.referred_by_patient_id IS NOT NULL THEN p.id END) as referral_patients,
    MIN(p.acquisition_date) as first_patient_date,
    MAX(p.acquisition_date) as last_patient_date
FROM public.categories s
LEFT JOIN public.patients p ON s.id = p.source_id
LEFT JOIN public.treatments t ON p.id = t.patient_id
WHERE s.entity_type = 'patient_source'
GROUP BY s.id, s.display_name, s.clinic_id;

-- 11. Insertar categorías de fuentes de pacientes si no existen
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('patient_source', 'campaña', 'Campaña', true, 1),
    ('patient_source', 'referido', 'Referido', true, 2),
    ('patient_source', 'directo', 'Directo', true, 3),
    ('patient_source', 'redes_sociales', 'Redes Sociales', true, 4),
    ('patient_source', 'sitio_web', 'Sitio Web', true, 5),
    ('patient_source', 'recomendacion', 'Recomendación', true, 6),
    ('patient_source', 'otro', 'Otro', true, 99)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- Success message
SELECT 'Migración completada: Sistema de marketing implementado' as status;
