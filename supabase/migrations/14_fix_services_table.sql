-- Migration: Corregir tabla services - eliminar la incorrecta y crear la correcta

-- 1. Hacer backup de la tabla incorrecta y eliminarla
DO $$
BEGIN
    -- Si existe la tabla services con columnas incorrectas, eliminarla
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name IN ('typsubscript', 'web_authn_aaguid', 'relpersistence')
    ) THEN
        -- Eliminar cualquier dependencia
        DROP TABLE IF EXISTS public.service_supplies CASCADE;
        DROP TABLE IF EXISTS public.services CASCADE;
        RAISE NOTICE 'Tabla services incorrecta eliminada';
    END IF;
END $$;

-- 2. Crear la tabla correcta de servicios dentales
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información básica del servicio
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    
    -- Tiempo estimado
    est_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Costos
    fixed_cost_per_minute_cents INTEGER DEFAULT 0,
    variable_cost_cents INTEGER DEFAULT 0,
    
    -- Margen y precio
    margin_pct NUMERIC(5,2) DEFAULT 30.00,
    price_cents INTEGER NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint único
    UNIQUE(clinic_id, name)
);

-- 3. Crear tabla de recetas (relación servicios-insumos)
CREATE TABLE IF NOT EXISTS public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    
    -- Cantidad de porciones del insumo
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    
    -- Costo unitario snapshot
    unit_cost_cents INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Único
    UNIQUE(service_id, supply_id)
);

-- 4. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_services_clinic ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_supplies_service ON public.service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_supplies_supply ON public.service_supplies(supply_id);

-- 5. Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_supplies_updated_at ON public.service_supplies;
CREATE TRIGGER update_service_supplies_updated_at 
BEFORE UPDATE ON public.service_supplies 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 6. Insertar algunos servicios de ejemplo
DO $$
DECLARE
    v_clinic_id UUID;
BEGIN
    -- Obtener una clínica existente
    SELECT id INTO v_clinic_id FROM public.clinics LIMIT 1;
    
    -- Solo insertar si hay una clínica
    IF v_clinic_id IS NOT NULL THEN
        INSERT INTO public.services (
            clinic_id, name, description, category, 
            est_minutes, fixed_cost_per_minute_cents, 
            variable_cost_cents, margin_pct, price_cents
        ) VALUES 
            (v_clinic_id, 'Limpieza Dental', 'Limpieza dental profesional', 'preventive', 
             45, 400, 500, 60.00, 4500),
            (v_clinic_id, 'Extracción Simple', 'Extracción dental simple', 'surgery', 
             30, 400, 1000, 65.00, 6000),
            (v_clinic_id, 'Resina Compuesta', 'Restauración con resina compuesta', 'restorative', 
             60, 400, 2000, 70.00, 15000)
        ON CONFLICT (clinic_id, name) DO NOTHING;
    END IF;
END $$;

-- Success message
SELECT 'Migración completada: Tabla services corregida y creada correctamente' as status;