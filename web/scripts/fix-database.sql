-- =====================================================
-- SCRIPT PARA ARREGLAR PROBLEMAS DE LA BASE DE DATOS
-- =====================================================

-- 1. VERIFICAR Y ARREGLAR LA TABLA settings_time
-- ------------------------------------------------
-- Primero verificamos qué columnas tiene actualmente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'settings_time';

-- Si falta la columna real_pct, la agregamos
ALTER TABLE settings_time 
ADD COLUMN IF NOT EXISTS real_pct NUMERIC(3,2) DEFAULT 0.80;

-- Si existe una columna con otro nombre (como real_percentage o effective_pct), 
-- renombramos a real_pct
-- DESCOMENTA LA LÍNEA CORRECTA SI ES NECESARIO:
-- ALTER TABLE settings_time RENAME COLUMN real_percentage TO real_pct;
-- ALTER TABLE settings_time RENAME COLUMN effective_pct TO real_pct;
-- ALTER TABLE settings_time RENAME COLUMN effective_percentage TO real_pct;

-- 2. VERIFICAR Y ARREGLAR LA TABLA fixed_costs
-- ---------------------------------------------
-- Verificar estructura actual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fixed_costs';

-- Asegurar que amount_cents es INTEGER
ALTER TABLE fixed_costs 
ALTER COLUMN amount_cents TYPE INTEGER USING amount_cents::INTEGER;

-- 3. VERIFICAR Y ARREGLAR LA TABLA assets
-- ----------------------------------------
-- Verificar estructura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assets';

-- Asegurar columnas necesarias
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS purchase_price_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS depreciation_months INTEGER NOT NULL DEFAULT 36;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- 4. VERIFICAR Y ARREGLAR LA TABLA services
-- ------------------------------------------
-- Verificar estructura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'services';

-- Asegurar que est_minutes existe
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS est_minutes INTEGER NOT NULL DEFAULT 30;

-- Si existe duration_minutes, copiar datos y eliminar
-- UPDATE services SET est_minutes = duration_minutes WHERE duration_minutes IS NOT NULL;
-- ALTER TABLE services DROP COLUMN IF EXISTS duration_minutes;

-- 5. VERIFICAR Y ARREGLAR LA TABLA service_supplies
-- --------------------------------------------------
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, supply_id)
);

-- 6. VERIFICAR Y ARREGLAR LA TABLA patients
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    birth_date DATE,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para patients
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- 7. VERIFICAR Y ARREGLAR LA TABLA treatments
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    
    -- Snapshot de costos al momento del tratamiento
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    final_price_cents INTEGER NOT NULL,
    
    -- Información adicional
    notes TEXT,
    paid BOOLEAN DEFAULT false,
    payment_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para treatments
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments(treatment_date);

-- 8. VERIFICAR DATOS CORRUPTOS EN fixed_costs
-- --------------------------------------------
-- Si hay montos que parecen estar multiplicados por 100
-- (por ejemplo, 200000 en lugar de 2000 para $20)
-- DESCOMENTA ESTO SOLO SI ES NECESARIO:
-- UPDATE fixed_costs 
-- SET amount_cents = amount_cents / 100 
-- WHERE amount_cents > 1000000; -- Solo montos mayores a $10,000 pesos

-- 9. CREAR VISTA PARA REPORTES
-- -----------------------------
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT 
    DATE_TRUNC('month', treatment_date) as month,
    COUNT(DISTINCT patient_id) as unique_patients,
    COUNT(*) as total_treatments,
    SUM(final_price_cents) as revenue_cents,
    SUM(variable_cost_cents) as variable_costs_cents,
    SUM(fixed_cost_per_minute_cents * minutes) as fixed_costs_cents,
    AVG(final_price_cents) as avg_ticket_cents
FROM treatments
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', treatment_date);

-- 10. GRANT PERMISOS (si es necesario)
-- -------------------------------------
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- Para verificar que todo está bien, ejecuta:
SELECT 
    'settings_time' as tabla,
    COUNT(*) as registros,
    string_agg(column_name, ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'settings_time'
UNION ALL
SELECT 
    'fixed_costs' as tabla,
    COUNT(*) as registros,
    string_agg(column_name, ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'fixed_costs'
UNION ALL
SELECT 
    'assets' as tabla,
    COUNT(*) as registros,
    string_agg(column_name, ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'assets'
UNION ALL
SELECT 
    'services' as tabla,
    COUNT(*) as registros,
    string_agg(column_name, ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'services';