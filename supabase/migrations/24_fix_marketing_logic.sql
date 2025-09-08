-- Fix: Corregir lógica del sistema de marketing según requisitos

-- 1. Eliminar "Otro" de las plataformas por defecto (no tiene sentido como default)
DELETE FROM public.categories 
WHERE entity_type = 'marketing_platform' 
AND name = 'other' 
AND is_system = true;

-- 2. Limpiar duplicados si existen y recrear solo las necesarias
DELETE FROM public.categories 
WHERE entity_type = 'marketing_platform' 
AND is_system = true;

-- 3. Insertar solo las plataformas principales (sin "Otro")
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, 1),
    ('marketing_platform', 'google_ads', 'Google Ads', true, 2),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, 3),
    ('marketing_platform', 'facebook_organic', 'Facebook Orgánico', true, 4),
    ('marketing_platform', 'instagram_organic', 'Instagram Orgánico', true, 5),
    ('marketing_platform', 'linkedin_ads', 'LinkedIn Ads', true, 6),
    ('marketing_platform', 'youtube_ads', 'YouTube Ads', true, 7),
    ('marketing_platform', 'twitter_ads', 'Twitter Ads', true, 8)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- 4. Verificar el resultado
SELECT 
    entity_type,
    name,
    display_name,
    is_system,
    clinic_id,
    display_order
FROM public.categories 
WHERE entity_type = 'marketing_platform'
ORDER BY is_system DESC, display_order, display_name;

-- Success
SELECT 'Marketing logic fixed - removed "Otro", added proper platforms' as status;
