-- Migration: Limpiar datos de prueba antiguos
-- Elimina los datos creados automáticamente por migraciones anteriores

-- 1. Eliminar clínicas de prueba
DELETE FROM public.clinics 
WHERE name IN ('Toluca Centro', 'Toluca Norte');

-- 2. Eliminar organizations de prueba (si no tienen clínicas asociadas)
DELETE FROM public.organizations 
WHERE name = 'PoDent Group'
AND NOT EXISTS (
  SELECT 1 FROM public.clinics 
  WHERE clinics.org_id = organizations.id
);

-- 3. Comentar o eliminar las inserciones automáticas en migraciones futuras
-- NOTA: Las migraciones anteriores ya ejecutadas no se pueden modificar,
-- pero esta migración limpia los datos que crearon

-- Success
SELECT 'Migración completada: Datos de prueba eliminados' as status;