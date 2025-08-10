-- Migration: Corregir tablas existentes y completar estructura

-- 1. Agregar columna is_active a clinics si no existe
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Manejar la tabla settings_time
DROP TABLE IF EXISTS public.settings_time CASCADE;

CREATE TABLE public.settings_time (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
    working_days_per_month INTEGER DEFAULT 20,
    hours_per_day NUMERIC(4,2) DEFAULT 7,
    planned_hours_per_month NUMERIC(6,2) GENERATED ALWAYS AS (working_days_per_month * hours_per_day) STORED,
    real_hours_percentage NUMERIC(5,2) DEFAULT 80.00,
    real_hours_per_month NUMERIC(6,2) GENERATED ALWAYS AS (working_days_per_month * hours_per_day * real_hours_percentage / 100) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Eliminar y recrear services correctamente
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

-- 4. Crear service_supplies
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

-- 5. Crear patients si no existe
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    birth_date DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    medications TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, email)
);

-- 6. Crear treatments si no existe
CREATE TABLE IF NOT EXISTS public.treatments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    treatment_date DATE NOT NULL,
    treatment_time TIME,
    duration_minutes INTEGER NOT NULL,
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    price_cents INTEGER NOT NULL,
    snapshot_costs JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 7. Crear expenses si no existe
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    amount_cents INTEGER NOT NULL,
    vendor VARCHAR(255),
    invoice_number VARCHAR(100),
    is_recurring BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true,
    payment_method VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Crear tariffs si no existe
CREATE TABLE IF NOT EXISTS public.tariffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    valid_from DATE NOT NULL,
    valid_until DATE,
    fixed_cost_per_minute_cents INTEGER NOT NULL,
    variable_cost_cents INTEGER NOT NULL,
    margin_pct NUMERIC(5,2) NOT NULL,
    price_cents INTEGER NOT NULL,
    rounded_price_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, version)
);

-- 9. Manejar la tabla assets
DROP TABLE IF EXISTS public.assets CASCADE;

CREATE TABLE public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    purchase_date DATE NOT NULL,
    purchase_price_cents INTEGER NOT NULL,
    depreciation_years INTEGER DEFAULT 3,
    depreciation_months INTEGER GENERATED ALWAYS AS (depreciation_years * 12) STORED,
    monthly_depreciation_cents INTEGER GENERATED ALWAYS AS (purchase_price_cents / NULLIF(depreciation_years * 12, 0)) STORED,
    is_active BOOLEAN DEFAULT true,
    disposal_date DATE,
    disposal_value_cents INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Manejar la tabla fixed_costs
DROP TABLE IF EXISTS public.fixed_costs CASCADE;

CREATE TABLE public.fixed_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    concept VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, concept)
);

-- 11. Crear índices
CREATE INDEX IF NOT EXISTS idx_services_clinic ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_supplies_service ON public.service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON public.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON public.treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_clinic ON public.expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_tariffs_service ON public.tariffs(service_id);
CREATE INDEX IF NOT EXISTS idx_assets_clinic ON public.assets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_clinic ON public.fixed_costs(clinic_id);

-- 12. Función y triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
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

-- 13. Insertar datos iniciales de manera segura
DO $$
DECLARE
    v_clinic_id UUID;
BEGIN
    -- Obtener una clínica
    SELECT id INTO v_clinic_id FROM public.clinics LIMIT 1;
    
    IF v_clinic_id IS NOT NULL THEN
        -- Settings de tiempo
        INSERT INTO public.settings_time (
            clinic_id, 
            working_days_per_month, 
            hours_per_day, 
            real_hours_percentage
        )
        VALUES (v_clinic_id, 20, 7, 80.00)
        ON CONFLICT (clinic_id) DO NOTHING;
        
        -- Activos de ejemplo
        INSERT INTO public.assets (clinic_id, name, category, purchase_date, purchase_price_cents, depreciation_years)
        SELECT v_clinic_id, 'Autoclave', 'Equipo', CURRENT_DATE - INTERVAL '6 months', 750000, 5
        WHERE NOT EXISTS (SELECT 1 FROM public.assets WHERE clinic_id = v_clinic_id AND name = 'Autoclave');
        
        INSERT INTO public.assets (clinic_id, name, category, purchase_date, purchase_price_cents, depreciation_years)
        SELECT v_clinic_id, 'Sillón Dental', 'Mobiliario', CURRENT_DATE - INTERVAL '1 year', 2500000, 7
        WHERE NOT EXISTS (SELECT 1 FROM public.assets WHERE clinic_id = v_clinic_id AND name = 'Sillón Dental');
        
        -- Costos fijos
        INSERT INTO public.fixed_costs (clinic_id, category, concept, amount_cents)
        VALUES 
            (v_clinic_id, 'Local', 'Renta', 300000),
            (v_clinic_id, 'Local', 'Luz', 25000),
            (v_clinic_id, 'Local', 'Agua', 20000),
            (v_clinic_id, 'Personal', 'Asistente', 1200000)
        ON CONFLICT (clinic_id, concept) DO NOTHING;
        
        -- Servicios básicos
        INSERT INTO public.services (
            clinic_id, name, description, category, 
            est_minutes, fixed_cost_per_minute_cents, 
            variable_cost_cents, margin_pct, price_cents
        ) VALUES 
            (v_clinic_id, 'Consulta', 'Consulta de valoración', 'diagnostic', 
             30, 276, 500, 50.00, 2500),
            (v_clinic_id, 'Limpieza Dental', 'Limpieza dental profesional', 'preventive', 
             60, 276, 1500, 60.00, 10000)
        ON CONFLICT (clinic_id, name) DO NOTHING;
    END IF;
END $$;

-- Success
SELECT 'Migración completada: Todas las tablas creadas o actualizadas correctamente' as status;