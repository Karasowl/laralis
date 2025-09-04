-- Solución definitiva: Cambiar la foreign key para que apunte a categories

-- 1. Eliminar la foreign key actual
ALTER TABLE marketing_campaigns 
DROP CONSTRAINT IF EXISTS marketing_campaigns_platform_category_id_fkey;

-- 2. Crear nueva foreign key apuntando a categories
ALTER TABLE marketing_campaigns
ADD CONSTRAINT marketing_campaigns_platform_category_id_fkey 
FOREIGN KEY (platform_category_id) 
REFERENCES categories(id) 
ON DELETE RESTRICT;

-- 3. Verificar que funciona creando una campaña de prueba
INSERT INTO marketing_campaigns (
    clinic_id,
    platform_category_id,
    name,
    code
) VALUES (
    '057bc830-8b37-4b02-b891-fb49e0be21f3',
    '4bf7110b-4a1e-48e2-8518-07091b01f396', -- Meta Ads ID
    'Test Campaign After Fix',
    'TEST-FIX-001'
);

-- 4. Verificar que se creó
SELECT * FROM marketing_campaigns WHERE code = 'TEST-FIX-001';
