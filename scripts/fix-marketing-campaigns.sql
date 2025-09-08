-- Solución temporal: Crear entradas en custom_categories para las plataformas de marketing
-- Esto permitirá que las campañas se creen correctamente

-- Primero, insertar las plataformas de marketing en custom_categories si no existen
INSERT INTO public.custom_categories (
    id,
    clinic_id, 
    name, 
    display_name,
    entity_type,
    is_active,
    created_at
)
SELECT 
    id,
    clinic_id,
    name,
    display_name,
    entity_type,
    is_active,
    created_at
FROM public.categories
WHERE entity_type = 'marketing_platform'
ON CONFLICT (id) DO NOTHING;

-- Verificar que se insertaron
SELECT * FROM custom_categories WHERE entity_type = 'marketing_platform';
