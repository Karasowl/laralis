-- Seed: Plataformas de marketing
-- Purpose: Poblar categorías de plataformas de marketing para sistema de campañas
-- Date: 2025-10-21

-- Insertar plataformas de marketing como categorías del sistema
-- Estas son globales (clinic_id = NULL) y se comparten entre todas las clínicas

INSERT INTO public.categories (
    entity_type,
    name,
    display_name,
    is_system,
    is_active,
    display_order,
    clinic_id
) VALUES
    -- Plataformas de publicidad pagada
    ('marketing_platform', 'google_ads', 'Google Ads', true, true, 1, NULL),
    ('marketing_platform', 'meta_ads', 'Meta Ads (Facebook/Instagram)', true, true, 2, NULL),
    ('marketing_platform', 'facebook_ads', 'Facebook Ads', true, true, 3, NULL),
    ('marketing_platform', 'instagram_ads', 'Instagram Ads', true, true, 4, NULL),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, true, 5, NULL),
    ('marketing_platform', 'linkedin_ads', 'LinkedIn Ads', true, true, 6, NULL),
    ('marketing_platform', 'twitter_ads', 'Twitter/X Ads', true, true, 7, NULL),

    -- Plataformas orgánicas
    ('marketing_platform', 'facebook_organic', 'Facebook Orgánico', true, true, 10, NULL),
    ('marketing_platform', 'instagram_organic', 'Instagram Orgánico', true, true, 11, NULL),
    ('marketing_platform', 'tiktok_organic', 'TikTok Orgánico', true, true, 12, NULL),
    ('marketing_platform', 'linkedin_organic', 'LinkedIn Orgánico', true, true, 13, NULL),
    ('marketing_platform', 'twitter_organic', 'Twitter/X Orgánico', true, true, 14, NULL),

    -- Email y SMS
    ('marketing_platform', 'email_marketing', 'Email Marketing', true, true, 20, NULL),
    ('marketing_platform', 'sms_marketing', 'SMS Marketing', true, true, 21, NULL),
    ('marketing_platform', 'whatsapp_business', 'WhatsApp Business', true, true, 22, NULL),

    -- Búsqueda y directorios
    ('marketing_platform', 'google_my_business', 'Google Mi Negocio', true, true, 30, NULL),
    ('marketing_platform', 'seo_organic', 'SEO Orgánico', true, true, 31, NULL),

    -- Referidos y tradicionales
    ('marketing_platform', 'referral_program', 'Programa de Referidos', true, true, 40, NULL),
    ('marketing_platform', 'word_of_mouth', 'Boca a Boca', true, true, 41, NULL),

    -- Tradicionales offline
    ('marketing_platform', 'print_advertising', 'Publicidad Impresa', true, true, 50, NULL),
    ('marketing_platform', 'radio', 'Radio', true, true, 51, NULL),
    ('marketing_platform', 'tv', 'Televisión', true, true, 52, NULL),
    ('marketing_platform', 'outdoor_billboard', 'Vallas/Espectaculares', true, true, 53, NULL),
    ('marketing_platform', 'flyers', 'Volantes/Folletos', true, true, 54, NULL),

    -- Eventos y patrocinios
    ('marketing_platform', 'events', 'Eventos', true, true, 60, NULL),
    ('marketing_platform', 'sponsorships', 'Patrocinios', true, true, 61, NULL),
    ('marketing_platform', 'trade_shows', 'Ferias/Exposiciones', true, true, 62, NULL),

    -- Otros
    ('marketing_platform', 'partnerships', 'Alianzas Estratégicas', true, true, 70, NULL),
    ('marketing_platform', 'direct_mail', 'Correo Directo', true, true, 71, NULL),
    ('marketing_platform', 'other', 'Otra Plataforma', true, true, 99, NULL)

ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- Verificar inserción
DO $$
DECLARE
    platform_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO platform_count
    FROM public.categories
    WHERE entity_type = 'marketing_platform';

    RAISE NOTICE '✅ Plataformas de marketing disponibles: %', platform_count;

    IF platform_count = 0 THEN
        RAISE WARNING '⚠️ No se insertaron plataformas. Verifica la estructura de la tabla categories.';
    ELSE
        RAISE NOTICE '🎯 Las plataformas están listas para crear campañas de marketing';
    END IF;
END $$;
