-- =====================================================
-- Script: Seed de plataformas de marketing predefinidas
-- Fecha: 2025-09-09
-- Descripción: Inserta las plataformas de marketing predefinidas
--              que toda clínica debe tener disponibles
-- =====================================================

-- 1. Eliminar todas las plataformas existentes (opcional - comentar si no se desea)
-- DELETE FROM categories WHERE entity_type = 'marketing_platform';

-- 2. Insertar plataformas predefinidas del sistema
-- Nota: Estas son plataformas del sistema (is_system = true) pero ahora sí se pueden eliminar
INSERT INTO public.categories (
    entity_type, 
    name, 
    display_name, 
    is_system, 
    is_active,
    display_order,
    clinic_id  -- NULL para que estén disponibles en todas las clínicas
) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, true, 1, NULL),
    ('marketing_platform', 'google_ads', 'Google Ads', true, true, 2, NULL),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, true, 3, NULL),
    ('marketing_platform', 'facebook_organic', 'Facebook Orgánico', true, true, 4, NULL),
    ('marketing_platform', 'instagram_organic', 'Instagram Orgánico', true, true, 5, NULL)
ON CONFLICT (clinic_id, entity_type, name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    is_system = EXCLUDED.is_system,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- 3. Verificar que las plataformas se insertaron correctamente
SELECT 
    id,
    name,
    display_name,
    is_system,
    is_active,
    display_order,
    clinic_id,
    created_at
FROM categories 
WHERE entity_type = 'marketing_platform'
ORDER BY display_order, display_name;

-- 4. Mostrar resumen
SELECT 
    'Plataformas de marketing insertadas:' as mensaje,
    COUNT(*) as total,
    COUNT(CASE WHEN is_system = true THEN 1 END) as plataformas_sistema,
    COUNT(CASE WHEN is_system = false THEN 1 END) as plataformas_personalizadas
FROM categories 
WHERE entity_type = 'marketing_platform';