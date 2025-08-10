-- Migration: Setup completo del sistema dental - Todas las tablas necesarias

-- 1. Agregar columna is_active a clinics si no existe
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Eliminar y recrear la tabla services correctamente
DROP TABLE IF EXISTS public.service_supplies CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;

CREATE TABLE public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    est_minutes INTEGER NOT NULL DEFAULT 60,
    fixed_cost_per_minute_cents INTEGER DEFAULT 0,
    variable_cost_cents INTEGER DEFAULT 0,
    margin_pct NUMERIC(5,2) DEFAULT 30.00,
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, name)
);

-- 3. Crear tabla service_supplies (recetas)
CREATE TABLE public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_cost_cents INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, supply_id)
);

-- 4. Crear tabla de pacientes
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información personal
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    birth_date DATE,
    gender VARCHAR(20),
    
    -- Dirección
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Información médica
    medical_history TEXT,
    allergies TEXT,
    medications TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(50),
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Índice único por email dentro de la clínica
    UNIQUE(clinic_id, email)
);

-- 5. Crear tabla de tratamientos
CREATE TABLE IF NOT EXISTS public.treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    
    -- Información del tratamiento
    treatment_date DATE NOT NULL,
    treatment_time TIME,
    duration_minutes INTEGER NOT NULL,
    
    -- Snapshot de costos (inmutable)
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    price_cents INTEGER NOT NULL,
    
    -- Datos adicionales del snapshot
    snapshot_costs JSONB DEFAULT '{}',
    
    -- Estado y notas
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 6. Crear tabla de gastos/expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información del gasto
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    amount_cents INTEGER NOT NULL,
    
    -- Proveedor
    vendor VARCHAR(255),
    invoice_number VARCHAR(100),
    
    -- Estado
    is_recurring BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true,
    payment_method VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Crear tabla de tarifas (versiones de precios)
CREATE TABLE IF NOT EXISTS public.tariffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    
    -- Versión de la tarifa
    version INTEGER NOT NULL DEFAULT 1,
    valid_from DATE NOT NULL,
    valid_until DATE,
    
    -- Costos y precios
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    price_cents INTEGER NOT NULL,
    rounded_price_cents INTEGER NOT NULL,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Solo una tarifa activa por servicio
    UNIQUE(service_id, version)
);

-- 8. Crear tabla settings_time (configuración de tiempo)
CREATE TABLE IF NOT EXISTS public.settings_time (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
    
    -- Configuración de tiempo
    working_days_per_month INTEGER DEFAULT 20,
    hours_per_day NUMERIC(4,2) DEFAULT 7,
    planned_hours_per_month NUMERIC(6,2) GENERATED ALWAYS AS (working_days_per_month * hours_per_day) STORED,
    real_hours_percentage NUMERIC(5,2) DEFAULT 80.00,
    real_hours_per_month NUMERIC(6,2) GENERATED ALWAYS AS (working_days_per_month * hours_per_day * real_hours_percentage / 100) STORED,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Crear tabla de activos/assets (para depreciación)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información del activo
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    purchase_date DATE NOT NULL,
    purchase_price_cents INTEGER NOT NULL,
    
    -- Depreciación
    depreciation_years INTEGER DEFAULT 3,
    depreciation_months INTEGER GENERATED ALWAYS AS (depreciation_years * 12) STORED,
    monthly_depreciation_cents INTEGER GENERATED ALWAYS AS (purchase_price_cents / NULLIF(depreciation_years * 12, 0)) STORED,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    disposal_date DATE,
    disposal_value_cents INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Crear tabla de costos fijos
CREATE TABLE IF NOT EXISTS public.fixed_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información del costo
    category VARCHAR(100) NOT NULL,
    concept VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Único por clínica y concepto
    UNIQUE(clinic_id, concept)
);

-- 11. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_services_clinic ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_supplies_service ON public.service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_active ON public.patients(is_active);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON public.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_service ON public.treatments(service_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON public.treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_clinic ON public.expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_tariffs_service ON public.tariffs(service_id);
CREATE INDEX IF NOT EXISTS idx_tariffs_active ON public.tariffs(is_active);
CREATE INDEX IF NOT EXISTS idx_assets_clinic ON public.assets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_clinic ON public.fixed_costs(clinic_id);

-- 12. Crear triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a todas las tablas con updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'updated_at'
        AND table_name IN ('services', 'service_supplies', 'patients', 'treatments', 
                          'expenses', 'tariffs', 'settings_time', 'assets', 'fixed_costs')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 13. Insertar datos de ejemplo
DO $$
DECLARE
    v_clinic_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Obtener workspace y clínica
    SELECT id INTO v_workspace_id FROM public.workspaces LIMIT 1;
    SELECT id INTO v_clinic_id FROM public.clinics WHERE workspace_id = v_workspace_id LIMIT 1;
    
    IF v_clinic_id IS NOT NULL THEN
        -- Configuración de tiempo
        INSERT INTO public.settings_time (clinic_id, working_days_per_month, hours_per_day, real_hours_percentage)
        VALUES (v_clinic_id, 20, 7, 80.00)
        ON CONFLICT (clinic_id) DO NOTHING;
        
        -- Algunos activos de ejemplo
        INSERT INTO public.assets (clinic_id, name, category, purchase_date, purchase_price_cents, depreciation_years)
        VALUES 
            (v_clinic_id, 'Autoclave', 'Equipo', CURRENT_DATE - INTERVAL '6 months', 750000, 5),
            (v_clinic_id, 'Sillón Dental', 'Mobiliario', CURRENT_DATE - INTERVAL '1 year', 2500000, 7),
            (v_clinic_id, 'Rayos X Digital', 'Equipo', CURRENT_DATE - INTERVAL '3 months', 1800000, 5)
        ON CONFLICT DO NOTHING;
        
        -- Costos fijos de ejemplo
        INSERT INTO public.fixed_costs (clinic_id, category, concept, amount_cents)
        VALUES 
            (v_clinic_id, 'Local', 'Renta', 300000),
            (v_clinic_id, 'Local', 'Luz', 25000),
            (v_clinic_id, 'Local', 'Agua', 20000),
            (v_clinic_id, 'Personal', 'Asistente', 1200000),
            (v_clinic_id, 'Provisiones', 'Publicidad', 200000)
        ON CONFLICT (clinic_id, concept) DO NOTHING;
        
        -- Servicios de ejemplo si no existen
        INSERT INTO public.services (
            clinic_id, name, description, category, 
            est_minutes, fixed_cost_per_minute_cents, 
            variable_cost_cents, margin_pct, price_cents
        ) VALUES 
            (v_clinic_id, 'Consulta', 'Consulta de valoración', 'diagnostic', 
             30, 276, 500, 50.00, 2500),
            (v_clinic_id, 'Limpieza Dental', 'Limpieza dental profesional', 'preventive', 
             60, 276, 1500, 60.00, 10000),
            (v_clinic_id, 'Extracción Simple', 'Extracción dental simple', 'surgery', 
             45, 276, 2000, 65.00, 15000),
            (v_clinic_id, 'Resina Compuesta', 'Restauración con resina', 'restorative', 
             75, 276, 3500, 70.00, 25000)
        ON CONFLICT (clinic_id, name) DO NOTHING;
    END IF;
END $$;

-- Success message
SELECT 'Migración completada: Sistema dental completo configurado' as status;