-- =====================================================
-- SCRIPT COMPLETO PARA ARREGLAR TODOS LOS PROBLEMAS
-- Ejecuta este script en Supabase SQL Editor
-- =====================================================

-- 1. ARREGLAR COLUMNAS DE settings_time
-- ---------------------------------------------
-- Renombrar columnas para que coincidan con el código
ALTER TABLE settings_time 
RENAME COLUMN real_hours_percentage TO real_pct;

ALTER TABLE settings_time 
RENAME COLUMN working_days_per_month TO work_days;

-- Eliminar columnas calculadas (no deben estar en BD)
ALTER TABLE settings_time 
DROP COLUMN IF EXISTS planned_hours_per_month;

ALTER TABLE settings_time 
DROP COLUMN IF EXISTS real_hours_per_month;

-- 2. ARREGLAR MONTOS EN fixed_costs
-- ---------------------------------------------
-- Los montos están multiplicados por 100 extra
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100
WHERE amount_cents > 100000; -- Solo si están mal (mayor a 1000 pesos)

-- 3. CREAR TABLA service_supplies (relación servicios-insumos)
-- ---------------------------------------------
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

-- 4. CREAR TABLA patients
-- ---------------------------------------------
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

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- 5. CREAR TABLA treatments
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    
    -- Fecha y estado
    treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    treatment_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    
    -- Snapshot de costos al momento del tratamiento
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    final_price_cents INTEGER NOT NULL,
    
    -- Información adicional
    tooth_number VARCHAR(10),
    notes TEXT,
    
    -- Información de pago
    paid BOOLEAN DEFAULT false,
    payment_method VARCHAR(50), -- cash, card, transfer
    payment_date DATE,
    discount_pct NUMERIC(5,2) DEFAULT 0,
    discount_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_service_id ON treatments(service_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_treatments_status ON treatments(status);

-- 6. CREAR VISTA PARA DASHBOARD
-- ---------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_metrics AS
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
    (SELECT COALESCE(SUM(final_price_cents), 0)
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end
     AND t.status = 'completed') as revenue_cents,
    
    -- Ticket promedio
    (SELECT COALESCE(AVG(final_price_cents), 0)
     FROM treatments t, current_month cm
     WHERE t.treatment_date >= cm.month_start 
     AND t.treatment_date <= cm.month_end
     AND t.status = 'completed') as avg_ticket_cents,
    
    -- Pagos pendientes
    (SELECT COALESCE(SUM(final_price_cents), 0)
     FROM treatments
     WHERE status = 'completed'
     AND paid = false) as pending_payments_cents;

-- 7. VERIFICACIÓN FINAL
-- ---------------------------------------------
-- Este query te mostrará si todo quedó bien
SELECT 
    'Verificación Final' as titulo,
    '==================' as separador;

-- Verificar settings_time
SELECT 
    'settings_time' as tabla,
    COUNT(*) as registros,
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'settings_time' 
           AND column_name = 'real_pct') as tiene_real_pct,
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'settings_time' 
           AND column_name = 'work_days') as tiene_work_days;

-- Verificar fixed_costs
SELECT 
    'fixed_costs' as tabla,
    COUNT(*) as registros,
    MIN(amount_cents) as min_cents,
    MAX(amount_cents) as max_cents,
    AVG(amount_cents)::INTEGER as promedio_cents;

-- Verificar tablas nuevas
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✓ Existe'
        ELSE '✗ No existe'
    END as estado
FROM (
    VALUES 
        ('service_supplies'),
        ('patients'),
        ('treatments'),
        ('v_dashboard_metrics')
) AS needed(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = needed.table_name
    AND t.table_schema = 'public';

-- Ver datos de ejemplo de fixed_costs corregidos
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 5;