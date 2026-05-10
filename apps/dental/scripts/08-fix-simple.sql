-- =====================================================
-- SCRIPT SIMPLE - EJECUTA TODO DE UNA VEZ
-- =====================================================

-- 1. ARREGLAR settings_time (con manejo de errores)
DO $$ 
BEGIN
    -- Intentar renombrar real_hours_percentage a real_pct
    BEGIN
        ALTER TABLE settings_time RENAME COLUMN real_hours_percentage TO real_pct;
    EXCEPTION
        WHEN undefined_column THEN
            -- La columna no existe o ya fue renombrada
            NULL;
        WHEN duplicate_column THEN
            -- La columna real_pct ya existe
            NULL;
    END;
    
    -- Intentar renombrar working_days_per_month a work_days
    BEGIN
        ALTER TABLE settings_time RENAME COLUMN working_days_per_month TO work_days;
    EXCEPTION
        WHEN undefined_column THEN
            -- La columna no existe o ya fue renombrada
            NULL;
        WHEN duplicate_column THEN
            -- La columna work_days ya existe
            NULL;
    END;
END $$;

-- Eliminar columnas calculadas
ALTER TABLE settings_time DROP COLUMN IF EXISTS planned_hours_per_month;
ALTER TABLE settings_time DROP COLUMN IF EXISTS real_hours_per_month;

-- 2. ARREGLAR fixed_costs
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100
WHERE amount_cents > 100000;

-- 3. CREAR service_supplies
CREATE TABLE IF NOT EXISTS service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL,
    supply_id UUID NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar constraints solo si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_service') THEN
        ALTER TABLE service_supplies 
        ADD CONSTRAINT fk_service FOREIGN KEY (service_id) 
        REFERENCES services(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_supply') THEN
        ALTER TABLE service_supplies 
        ADD CONSTRAINT fk_supply FOREIGN KEY (supply_id) 
        REFERENCES supplies(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'unique_service_supply') THEN
        ALTER TABLE service_supplies 
        ADD CONSTRAINT unique_service_supply UNIQUE(service_id, supply_id);
    END IF;
END $$;

-- 4. CREAR patients
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

-- Índices solo si no existen
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- 5. ELIMINAR Y RECREAR treatments
DROP TABLE IF EXISTS treatments CASCADE;

CREATE TABLE treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    service_id UUID NOT NULL,
    
    -- Fecha y estado
    treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    treatment_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    
    -- Snapshot de costos
    fixed_cost_per_minute_cents INTEGER NOT NULL DEFAULT 0,
    minutes INTEGER NOT NULL DEFAULT 30,
    variable_cost_cents INTEGER NOT NULL DEFAULT 0,
    margin_pct NUMERIC(5,2) NOT NULL DEFAULT 30,
    price_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Información adicional
    tooth_number VARCHAR(10),
    notes TEXT,
    
    -- Información de pago
    is_paid BOOLEAN DEFAULT false,
    payment_method VARCHAR(50),
    payment_date DATE,
    discount_pct NUMERIC(5,2) DEFAULT 0,
    discount_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar foreign keys después de crear la tabla
ALTER TABLE treatments 
ADD CONSTRAINT fk_patient FOREIGN KEY (patient_id) 
REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE treatments 
ADD CONSTRAINT fk_service FOREIGN KEY (service_id) 
REFERENCES services(id);

-- Índices
CREATE INDEX idx_treatments_clinic_id ON treatments(clinic_id);
CREATE INDEX idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX idx_treatments_date ON treatments(treatment_date);

-- 6. CREAR VISTA DEL DASHBOARD
DROP VIEW IF EXISTS v_dashboard_metrics;

CREATE VIEW v_dashboard_metrics AS
SELECT 
    -- Pacientes del mes
    (SELECT COUNT(DISTINCT patient_id) 
     FROM treatments
     WHERE treatment_date >= DATE_TRUNC('month', CURRENT_DATE) 
     AND treatment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') as patients_this_month,
    
    -- Tratamientos completados del mes
    (SELECT COUNT(*) 
     FROM treatments
     WHERE treatment_date >= DATE_TRUNC('month', CURRENT_DATE) 
     AND treatment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
     AND status = 'completed') as treatments_this_month,
    
    -- Ingresos del mes
    (SELECT COALESCE(SUM(price_cents), 0)
     FROM treatments
     WHERE treatment_date >= DATE_TRUNC('month', CURRENT_DATE) 
     AND treatment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
     AND status = 'completed') as revenue_cents,
    
    -- Ticket promedio
    (SELECT COALESCE(AVG(price_cents), 0)::INTEGER
     FROM treatments
     WHERE treatment_date >= DATE_TRUNC('month', CURRENT_DATE) 
     AND treatment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
     AND status = 'completed') as avg_ticket_cents,
    
    -- Pagos pendientes
    (SELECT COALESCE(SUM(price_cents), 0)
     FROM treatments
     WHERE status = 'completed'
     AND is_paid = false) as pending_payments_cents;

-- 7. VERIFICACIÓN FINAL
SELECT 'VERIFICACIÓN FINAL' as titulo, '==================' as linea;

-- Verificar tablas
SELECT 
    n.table_name,
    CASE 
        WHEN t.table_name IS NOT NULL THEN '✓ Existe'
        ELSE '✗ No existe'
    END as estado
FROM (
    VALUES 
        ('settings_time'),
        ('fixed_costs'),
        ('service_supplies'),
        ('patients'),
        ('treatments')
) AS n(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = n.table_name
    AND t.table_schema = 'public';

-- Verificar columnas clave
SELECT 'Columnas clave:' as info;

SELECT 
    'settings_time.real_pct' as columna,
    CASE WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings_time' AND column_name = 'real_pct'
    ) THEN '✓' ELSE '✗' END as existe;

SELECT 
    'settings_time.work_days' as columna,
    CASE WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings_time' AND column_name = 'work_days'
    ) THEN '✓' ELSE '✗' END as existe;

SELECT 
    'treatments.is_paid' as columna,
    CASE WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'treatments' AND column_name = 'is_paid'
    ) THEN '✓' ELSE '✗' END as existe;

-- Ver algunos datos de fixed_costs
SELECT 'Muestra de fixed_costs (deberían ser montos razonables):' as info;
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 3;

-- Mensaje final
SELECT 
    '✅ Script ejecutado completamente' as mensaje,
    'Revisa los resultados arriba para confirmar que todo está correcto' as instrucciones;