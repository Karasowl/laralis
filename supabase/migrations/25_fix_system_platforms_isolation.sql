-- Fix: Corregir aislamiento de plataformas del sistema por clínica

-- 1. Las plataformas del sistema NO deben tener clinic_id (null)
-- 2. Las plataformas personalizadas SÍ deben tener clinic_id
-- 3. Esto permite el filtrado correcto: clinic_id.is.null OR clinic_id.eq.${clinicId}

BEGIN;

-- Paso 1: Marcar correctamente las plataformas del sistema
UPDATE public.categories 
SET clinic_id = NULL
WHERE entity_type = 'marketing_platform' 
  AND is_system = true;

-- Paso 2: Verificar que todas las plataformas personalizadas tengan clinic_id
-- (No debería haber ninguna, pero por seguridad)
SELECT 
    id, 
    name, 
    display_name, 
    clinic_id,
    is_system
FROM public.categories 
WHERE entity_type = 'marketing_platform'
  AND is_system = false 
  AND clinic_id IS NULL;

-- Si hay resultados arriba, significa que hay plataformas personalizadas sin clinic_id
-- Esto sería un bug crítico de seguridad

-- Paso 3: Verificar el resultado final
SELECT 
    'System platforms (clinic_id should be NULL)' as category,
    COUNT(*) as count
FROM public.categories 
WHERE entity_type = 'marketing_platform' 
  AND is_system = true 
  AND clinic_id IS NULL

UNION ALL

SELECT 
    'System platforms with clinic_id (SECURITY BUG!)' as category,
    COUNT(*) as count
FROM public.categories 
WHERE entity_type = 'marketing_platform' 
  AND is_system = true 
  AND clinic_id IS NOT NULL

UNION ALL

SELECT 
    'Custom platforms (clinic_id should be SET)' as category,
    COUNT(*) as count
FROM public.categories 
WHERE entity_type = 'marketing_platform' 
  AND is_system = false 
  AND clinic_id IS NOT NULL

UNION ALL

SELECT 
    'Custom platforms without clinic_id (SECURITY BUG!)' as category,
    COUNT(*) as count
FROM public.categories 
WHERE entity_type = 'marketing_platform' 
  AND is_system = false 
  AND clinic_id IS NULL;

COMMIT;

-- Success
SELECT 'Marketing platform isolation fixed - system platforms have clinic_id=NULL' as status;
