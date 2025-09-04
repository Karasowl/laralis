-- Script de verificación: ¿Existen las plataformas de marketing?

-- 1. Verificar si existen plataformas de marketing
SELECT 
    COUNT(*) as total_platforms,
    COUNT(CASE WHEN is_system = true THEN 1 END) as system_platforms,
    COUNT(CASE WHEN is_system = false THEN 1 END) as custom_platforms
FROM categories 
WHERE entity_type = 'marketing_platform';

-- 2. Mostrar las plataformas existentes
SELECT 
    id,
    name,
    display_name,
    is_system,
    is_active,
    display_order,
    clinic_id
FROM categories 
WHERE entity_type = 'marketing_platform'
ORDER BY display_order, display_name;

-- 3. Si no hay plataformas, ejecutar solo las que faltan
-- Las plataformas definidas en la migración 20_marketing_system.sql
DO $$
BEGIN
    -- Solo insertar si no hay ninguna plataforma
    IF NOT EXISTS (SELECT 1 FROM categories WHERE entity_type = 'marketing_platform') THEN
        RAISE NOTICE 'No hay plataformas de marketing. Insertando plataformas del sistema...';
        
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
        
        RAISE NOTICE 'Plataformas de marketing insertadas correctamente.';
    ELSE
        RAISE NOTICE 'Ya existen % plataformas de marketing en el sistema.', 
            (SELECT COUNT(*) FROM categories WHERE entity_type = 'marketing_platform');
    END IF;
END $$;

-- 4. Verificar el resultado final
SELECT 
    'RESULTADO FINAL:' as info,
    COUNT(*) as total_platforms
FROM categories 
WHERE entity_type = 'marketing_platform';