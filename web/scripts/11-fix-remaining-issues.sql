-- =====================================================
-- SCRIPT PARA ARREGLAR PROBLEMAS RESTANTES
-- =====================================================

-- 1. CORREGIR MONTOS EN fixed_costs (si siguen mal)
-- ---------------------------------------------
SELECT 'Verificando fixed_costs...' as status;

-- Ver montos actuales
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    CASE 
        WHEN amount_cents > 100000 THEN 'NECESITA CORRECCIÓN'
        ELSE 'OK'
    END as estado
FROM fixed_costs
ORDER BY created_at DESC;

-- Corregir montos incorrectos
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100
WHERE amount_cents > 100000;

-- 2. VERIFICAR TABLA patients
-- ---------------------------------------------
SELECT 'Verificando patients...' as status;

-- Verificar que existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients')
        THEN '✓ Tabla patients existe'
        ELSE '✗ Tabla patients NO existe'
    END as estado;

-- Si no existe, crearla
CREATE TABLE IF NOT EXISTS patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    birth_date DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- 3. VERIFICAR Y LIMPIAR CATEGORÍAS DUPLICADAS
-- ---------------------------------------------
SELECT 'Verificando categorías...' as status;

-- Ver categorías actuales
SELECT 
    name,
    display_name,
    is_system,
    COUNT(*) as cantidad
FROM service_categories
GROUP BY name, display_name, is_system
HAVING COUNT(*) > 1;

-- Eliminar duplicados (mantener solo uno de cada)
DELETE FROM service_categories a
USING service_categories b
WHERE a.id > b.id 
AND a.name = b.name 
AND a.clinic_id = b.clinic_id;

-- 4. ASEGURAR QUE service_supplies EXISTE
-- ---------------------------------------------
SELECT 'Verificando service_supplies...' as status;

CREATE TABLE IF NOT EXISTS service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL,
    supply_id UUID NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solo agregar constraints si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_service_supply'
    ) THEN
        ALTER TABLE service_supplies 
        ADD CONSTRAINT unique_service_supply UNIQUE(service_id, supply_id);
    END IF;
END $$;

-- 5. VERIFICAR PERMISOS (importante para que funcione el API)
-- ---------------------------------------------
SELECT 'Verificando permisos...' as status;

-- Dar permisos a authenticated users
GRANT ALL ON patients TO authenticated;
GRANT ALL ON treatments TO authenticated;
GRANT ALL ON service_supplies TO authenticated;
GRANT ALL ON v_dashboard_metrics TO authenticated;

-- Dar permisos para las secuencias
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. VERIFICACIÓN FINAL
-- ---------------------------------------------
SELECT 'VERIFICACIÓN FINAL' as status;

-- Verificar tablas
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✓ Existe'
        ELSE '✗ No existe'
    END as estado
FROM (
    VALUES 
        ('patients'),
        ('treatments'),
        ('service_supplies'),
        ('service_categories')
) AS needed(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = needed.table_name
    AND t.table_schema = 'public';

-- Ver fixed_costs corregidos
SELECT 
    'Fixed costs después de corrección:' as info,
    COUNT(*) as total,
    MIN(amount_cents) as min_cents,
    MAX(amount_cents) as max_cents,
    AVG(amount_cents)::INTEGER as promedio_cents
FROM fixed_costs;

-- Ver categorías sin duplicados
SELECT 
    'Categorías después de limpieza:' as info,
    COUNT(DISTINCT name) as categorias_unicas,
    COUNT(*) as total_registros
FROM service_categories;

SELECT '✅ Script ejecutado. Revisa los resultados arriba.' as mensaje;