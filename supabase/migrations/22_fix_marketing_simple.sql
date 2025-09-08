-- Fix: Crear sistema de marketing paso a paso

-- 1. Primero verificar/crear categorías de marketing platform
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

-- 2. Crear tabla de campañas si no existe
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    platform_id UUID NOT NULL,
    
    -- Información de la campaña
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic ON public.marketing_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON public.marketing_campaigns(platform_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON public.marketing_campaigns(is_active);

-- 4. Agregar campos a patients si no existen
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS campaign_id UUID,
ADD COLUMN IF NOT EXISTS referred_by_patient_id UUID,
ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- 5. Crear categorías de fuentes de pacientes
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('patient_source', 'campaña', 'Campaña', true, 1),
    ('patient_source', 'referido', 'Referido', true, 2),
    ('patient_source', 'directo', 'Directo', true, 3),
    ('patient_source', 'redes_sociales', 'Redes Sociales', true, 4),
    ('patient_source', 'sitio_web', 'Sitio Web', true, 5),
    ('patient_source', 'recomendacion', 'Recomendación', true, 6),
    ('patient_source', 'otro', 'Otro', true, 99)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- 6. Deshabilitar RLS para las nuevas tablas (temporal)
ALTER TABLE public.marketing_campaigns DISABLE ROW LEVEL SECURITY;

-- Success
SELECT 'Marketing system created successfully' as status;
