-- Solución: Crear entradas en custom_categories para las plataformas de marketing
-- Versión corregida sin entity_type

-- Primero, verificar la estructura de custom_categories
\d custom_categories

-- Insertar las plataformas de marketing en custom_categories
INSERT INTO public.custom_categories (
    id,
    clinic_id, 
    name, 
    display_name,
    is_active
)
SELECT 
    id,
    clinic_id,
    name,
    display_name,
    is_active
FROM public.categories
WHERE entity_type = 'marketing_platform'
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active;

-- Verificar que se insertaron correctamente
SELECT id, clinic_id, name, display_name, is_active 
FROM custom_categories 
WHERE id IN (
    SELECT id FROM categories WHERE entity_type = 'marketing_platform'
);
