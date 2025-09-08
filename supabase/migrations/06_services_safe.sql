-- Migration: Safe update of services table structure

-- First, check and add missing columns
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'otros';

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- If duration_minutes doesn't exist but est_minutes does, rename it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' 
                   AND column_name = 'duration_minutes') 
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' 
                   AND column_name = 'est_minutes') THEN
        ALTER TABLE public.services RENAME COLUMN est_minutes TO duration_minutes;
    END IF;
END $$;

-- If neither duration_minutes nor est_minutes exist, add duration_minutes
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;

-- Update any NULL duration_minutes to default value
UPDATE public.services 
SET duration_minutes = 30 
WHERE duration_minutes IS NULL;

-- Update category constraint
ALTER TABLE public.services 
DROP CONSTRAINT IF EXISTS services_category_check;

ALTER TABLE public.services 
ADD CONSTRAINT services_category_check 
CHECK (category IN ('preventivo', 'restaurativo', 'endodoncia', 'cirugia', 'estetica', 'ortodoncia', 'protesis', 'periodoncia', 'otros'));

-- Update duration constraint
ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_duration_minutes_check;

ALTER TABLE public.services
ADD CONSTRAINT services_duration_minutes_check
CHECK (duration_minutes > 0);

-- Create service_supplies table if not exists
CREATE TABLE IF NOT EXISTS public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, supply_id)
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_service_supplies_service_id ON public.service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_supplies_supply_id ON public.service_supplies(supply_id);

-- Add trigger for updated_at if doesn't exist
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.services IS 'Dental services catalog with duration and category';
COMMENT ON TABLE public.service_supplies IS 'Recipe of supplies needed for each service';
COMMENT ON COLUMN public.services.duration_minutes IS 'Estimated duration of the service in minutes';
COMMENT ON COLUMN public.service_supplies.quantity IS 'Number of portions of the supply needed';

-- Success message
SELECT 'Migration completed successfully!' as status;