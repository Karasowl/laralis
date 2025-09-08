-- Migration: Eliminar tabla services incorrecta y crear la correcta

-- 1. Primero eliminar la tabla services incorrecta (es una vista del sistema)
DROP TABLE IF EXISTS public.services CASCADE;
DROP VIEW IF EXISTS public.services CASCADE;

-- 2. Crear la tabla correcta de servicios dentales
CREATE TABLE public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información básica del servicio
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    active BOOLEAN DEFAULT true, -- Usamos 'active' no 'is_active' por consistencia
    
    -- Tiempo estimado
    est_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Costos
    fixed_cost_per_minute_cents INTEGER DEFAULT 0, -- Costo fijo por minuto
    variable_cost_cents INTEGER DEFAULT 0, -- Costo variable total de insumos
    
    -- Margen y precio
    margin_pct NUMERIC(5,2) DEFAULT 30.00, -- Margen de ganancia en porcentaje
    price_cents INTEGER NOT NULL DEFAULT 0, -- Precio final al cliente
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint único por clínica y nombre
    UNIQUE(clinic_id, name)
);

-- 3. Crear tabla de recetas (relación servicios-insumos) si no existe
DROP TABLE IF EXISTS public.service_supplies CASCADE;
CREATE TABLE public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    
    -- Cantidad de porciones del insumo que usa este servicio
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    
    -- Costo unitario en el momento de asociación (snapshot)
    unit_cost_cents INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un insumo solo puede estar una vez por servicio
    UNIQUE(service_id, supply_id)
);

-- 4. Crear índices para performance
CREATE INDEX idx_services_clinic ON public.services(clinic_id);
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_services_active ON public.services(active);
CREATE INDEX idx_service_supplies_service ON public.service_supplies(service_id);
CREATE INDEX idx_service_supplies_supply ON public.service_supplies(supply_id);

-- 5. Crear o actualizar función para trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear triggers para mantener updated_at
CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_supplies_updated_at 
BEFORE UPDATE ON public.service_supplies 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 7. Insertar algunos servicios de ejemplo
INSERT INTO public.services (clinic_id, name, category, est_minutes, price_cents) 
SELECT 
    c.id,
    s.name,
    s.category,
    s.est_minutes,
    s.price_cents
FROM public.clinics c
CROSS JOIN (
    VALUES 
        ('Limpieza Dental', 'preventive', 45, 50000),
        ('Extracción Simple', 'surgery', 30, 80000),
        ('Resina Compuesta', 'restorative', 60, 120000),
        ('Endodoncia Unirradicular', 'endodontics', 90, 250000),
        ('Corona de Porcelana', 'prosthetics', 120, 450000)
) AS s(name, category, est_minutes, price_cents)
WHERE c.id = (SELECT id FROM public.clinics LIMIT 1)
ON CONFLICT (clinic_id, name) DO NOTHING;

-- Success
SELECT 'Migración completada: Tabla services recreada correctamente' as status;