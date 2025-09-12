-- =====================================================
-- Script: Reset completo del sistema de marketing
-- Fecha: 2025-09-09
-- Descripción: Limpia y reinicia el sistema de marketing
--              con las plataformas predefinidas
-- ADVERTENCIA: Este script eliminará TODAS las campañas y plataformas
-- =====================================================

-- 1. Verificar estado actual antes de limpiar
SELECT 'ESTADO ANTES DE LIMPIAR:' as etapa;
SELECT 
    'Campañas existentes:' as item,
    COUNT(*) as cantidad
FROM marketing_campaigns;

SELECT 
    'Plataformas existentes:' as item,
    COUNT(*) as cantidad
FROM categories 
WHERE entity_type = 'marketing_platform';

-- 2. Limpiar relaciones con pacientes (quitar referencias)
UPDATE patients 
SET campaign_id = NULL 
WHERE campaign_id IS NOT NULL;

-- 3. Eliminar todas las campañas de marketing
DELETE FROM marketing_campaigns;

-- 4. Eliminar todas las plataformas de marketing
DELETE FROM categories 
WHERE entity_type = 'marketing_platform';

-- 5. Insertar las 5 plataformas predefinidas
INSERT INTO public.categories (
    entity_type, 
    name, 
    display_name, 
    is_system, 
    is_active,
    display_order,
    clinic_id
) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, true, 1, NULL),
    ('marketing_platform', 'google_ads', 'Google Ads', true, true, 2, NULL),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, true, 3, NULL),
    ('marketing_platform', 'facebook_organic', 'Facebook Orgánico', true, true, 4, NULL),
    ('marketing_platform', 'instagram_organic', 'Instagram Orgánico', true, true, 5, NULL);

-- 6. Verificar el resultado final
SELECT 'ESTADO DESPUÉS DE REINICIAR:' as etapa;
SELECT 
    id,
    name,
    display_name,
    is_system,
    is_active,
    display_order
FROM categories 
WHERE entity_type = 'marketing_platform'
ORDER BY display_order;

-- 7. Resumen final
SELECT 
    'Sistema de marketing reiniciado' as resultado,
    'Plataformas predefinidas: 5' as detalle,
    'Todas las campañas fueron eliminadas' as nota;