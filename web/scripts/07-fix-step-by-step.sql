-- =====================================================
-- SCRIPT PASO A PASO - EJECUTA CADA SECCIÓN POR SEPARADO
-- =====================================================

-- SECCIÓN 1: DIAGNÓSTICO - EJECUTA PRIMERO ESTO
-- =====================================================
SELECT '=== DIAGNÓSTICO INICIAL ===' as seccion;

-- Ver columnas de treatments si existe
SELECT 
    'treatments columns' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'treatments'
GROUP BY table_name;

-- Ver columnas de settings_time
SELECT 
    'settings_time columns' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'settings_time'
GROUP BY table_name;

-- Ver si existe patients
SELECT 
    'patients exists' as info,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as existe;

-- Ver si existe service_supplies
SELECT 
    'service_supplies exists' as info,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_supplies') as existe;

-- SECCIÓN 2: ARREGLAR settings_time
-- =====================================================
SELECT '=== ARREGLANDO SETTINGS_TIME ===' as seccion;

-- Solo ejecuta las líneas que necesites según el diagnóstico:

-- Si existe real_hours_percentage, renombrar a real_pct:
-- ALTER TABLE settings_time RENAME COLUMN real_hours_percentage TO real_pct;

-- Si existe working_days_per_month, renombrar a work_days:
-- ALTER TABLE settings_time RENAME COLUMN working_days_per_month TO work_days;

-- Eliminar columnas calculadas
ALTER TABLE settings_time DROP COLUMN IF EXISTS planned_hours_per_month;
ALTER TABLE settings_time DROP COLUMN IF EXISTS real_hours_per_month;

-- SECCIÓN 3: ARREGLAR fixed_costs
-- =====================================================
SELECT '=== ARREGLANDO FIXED_COSTS ===' as seccion;

-- Ver montos actuales
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY amount_cents DESC
LIMIT 5;

-- Si los montos están muy altos (más de 100000 centavos = 1000 pesos), ejecuta:
-- UPDATE fixed_costs SET amount_cents = amount_cents / 100 WHERE amount_cents > 100000;

-- SECCIÓN 4: CREAR service_supplies SI NO EXISTE
-- =====================================================
SELECT '=== CREANDO SERVICE_SUPPLIES ===' as seccion;

CREATE TABLE IF NOT EXISTS service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL,
    supply_id UUID NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT fk_supply FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE CASCADE,
    CONSTRAINT unique_service_supply UNIQUE(service_id, supply_id)
);

-- SECCIÓN 5: CREAR patients SI NO EXISTE
-- =====================================================
SELECT '=== CREANDO PATIENTS ===' as seccion;

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

-- Índices
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- SECCIÓN 6: ARREGLAR O CREAR treatments
-- =====================================================
SELECT '=== ARREGLANDO TREATMENTS ===' as seccion;

-- Primero, eliminar la tabla treatments si existe (para recrearla correctamente)
DROP TABLE IF EXISTS treatments CASCADE;

-- Crear treatments con estructura correcta
CREATE TABLE treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    
    -- Fecha y estado
    treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    treatment_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    
    -- Snapshot de costos
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    price_cents INTEGER NOT NULL,
    
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

-- Índices
CREATE INDEX idx_treatments_clinic_id ON treatments(clinic_id);
CREATE INDEX idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX idx_treatments_date ON treatments(treatment_date);

-- SECCIÓN 7: CREAR VISTA DEL DASHBOARD
-- =====================================================
SELECT '=== CREANDO VISTA DASHBOARD ===' as seccion;

DROP VIEW IF EXISTS v_dashboard_metrics;

CREATE VIEW v_dashboard_metrics AS
WITH current_month AS (
    SELECT 
        DATE_TRUNC('month', CURRENT_DATE) as month_start,
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as month_end
)
SELECT 
    -- Pacientes del mes
    (SELECT COUNT(DISTINCT patient_id) 
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end) as patients_this_month,
    
    -- Tratamientos del mes
    (SELECT COUNT(*) 
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end
     AND t.status = 'completed') as treatments_this_month,
    
    -- Ingresos del mes
    (SELECT COALESCE(SUM(price_cents), 0)
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end
     AND t.status = 'completed') as revenue_cents,
    
    -- Ticket promedio
    (SELECT COALESCE(AVG(price_cents), 0)
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end
     AND t.status = 'completed') as avg_ticket_cents,
    
    -- Pagos pendientes
    (SELECT COALESCE(SUM(price_cents), 0)
     FROM treatments
     WHERE status = 'completed'
     AND is_paid = false) as pending_payments_cents;

-- SECCIÓN 8: VERIFICACIÓN FINAL
-- =====================================================
SELECT '=== VERIFICACIÓN FINAL ===' as seccion;

-- Verificar todas las tablas
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✓ OK'
        ELSE '✗ FALTA'
    END as estado
FROM (
    VALUES 
        ('settings_time'),
        ('fixed_costs'),
        ('assets'),
        ('supplies'),
        ('services'),
        ('service_supplies'),
        ('patients'),
        ('treatments')
) AS needed(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = needed.table_name
    AND t.table_schema = 'public';

-- Ver columnas clave de treatments
SELECT 
    'treatments tiene is_paid' as verificacion,
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'treatments' 
           AND column_name = 'is_paid') as resultado;

-- Ver columnas clave de settings_time
SELECT 
    'settings_time tiene real_pct' as verificacion,
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'settings_time' 
           AND column_name = 'real_pct') as resultado
UNION ALL
SELECT 
    'settings_time tiene work_days' as verificacion,
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'settings_time' 
           AND column_name = 'work_days') as resultado;