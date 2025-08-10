-- Migration: Services and Service Supplies tables

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('preventivo', 'restaurativo', 'endodoncia', 'cirugia', 'estetica', 'ortodoncia', 'protesis', 'periodoncia', 'otros')),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create service_supplies table (recipe/ingredients for each service)
CREATE TABLE IF NOT EXISTS public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, supply_id)
);

-- Add indexes
CREATE INDEX idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX idx_services_active ON public.services(active);
CREATE INDEX idx_service_supplies_service_id ON public.service_supplies(service_id);
CREATE INDEX idx_service_supplies_supply_id ON public.service_supplies(supply_id);

-- Add trigger for updated_at
CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.services IS 'Dental services catalog with duration and category';
COMMENT ON TABLE public.service_supplies IS 'Recipe of supplies needed for each service';
COMMENT ON COLUMN public.services.duration_minutes IS 'Estimated duration of the service in minutes';
COMMENT ON COLUMN public.service_supplies.quantity IS 'Number of portions of the supply needed';