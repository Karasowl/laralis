-- Solución: Crear plataformas de marketing en custom_categories para la clínica actual
-- IMPORTANTE: Reemplaza 'TU_CLINIC_ID' con el ID de tu clínica

-- Insertar las plataformas de marketing en custom_categories para tu clínica
INSERT INTO public.custom_categories (
    id,
    clinic_id, 
    name, 
    display_name,
    is_active
)
SELECT 
    gen_random_uuid() as id,  -- Generar nuevo ID único
    '057bc830-8b37-4b02-b891-fb49e0be21f3' as clinic_id,  -- Tu clinic_id
    name,
    display_name,
    is_active
FROM public.categories
WHERE entity_type = 'marketing_platform'
  AND is_system = true
ON CONFLICT (clinic_id, name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active;

-- Verificar que se insertaron correctamente
SELECT id, clinic_id, name, display_name, is_active 
FROM custom_categories 
WHERE clinic_id = '057bc830-8b37-4b02-b891-fb49e0be21f3'
  AND name IN (
    SELECT name FROM categories WHERE entity_type = 'marketing_platform'
);
