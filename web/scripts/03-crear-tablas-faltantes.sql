-- =====================================================
-- SCRIPT PARA CREAR TABLAS DE PACIENTES Y TRATAMIENTOS
-- =====================================================

-- 1. CREAR TABLA DE PACIENTES
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

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- 2. CREAR TABLA DE TRATAMIENTOS
CREATE TABLE IF NOT EXISTS treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    
    -- Fecha y estado
    treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    treatment_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    
    -- Snapshot de costos al momento del tratamiento (según idea original)
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    final_price_cents INTEGER NOT NULL,
    
    -- Información adicional
    tooth_number VARCHAR(10), -- Para tratamientos dentales específicos
    notes TEXT,
    
    -- Información de pago
    paid BOOLEAN DEFAULT false,
    payment_method VARCHAR(50), -- cash, card, transfer, etc.
    payment_date DATE,
    discount_pct NUMERIC(5,2) DEFAULT 0,
    discount_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_service_id ON treatments(service_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_treatments_status ON treatments(status);

-- 3. CREAR VISTA PARA EL DASHBOARD
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

-- 4. VERIFICAR QUE TODO SE CREÓ
SELECT 
    'patients' as tabla,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as existe
UNION ALL
SELECT 
    'treatments' as tabla,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'treatments') as existe
UNION ALL
SELECT 
    'v_dashboard_metrics' as tabla,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'v_dashboard_metrics') as existe;