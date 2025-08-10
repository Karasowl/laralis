-- Migration: Adaptive update for services tables

-- Update services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'otros';

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

-- Handle service_supplies table - check if it exists and what columns it has
DO $$
BEGIN
    -- If table doesn't exist, create it with 'quantity' column
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'service_supplies') THEN
        CREATE TABLE public.service_supplies (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
            quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(service_id, supply_id)
        );
    ELSE
        -- Table exists, check if it has 'qty' column and needs to be renamed to 'quantity'
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'service_supplies' 
                   AND column_name = 'qty')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'service_supplies' 
                           AND column_name = 'quantity') THEN
            -- Rename qty to quantity
            ALTER TABLE public.service_supplies RENAME COLUMN qty TO quantity;
        END IF;
        
        -- If neither qty nor quantity exist, add quantity
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'service_supplies' 
                       AND column_name IN ('qty', 'quantity')) THEN
            ALTER TABLE public.service_supplies 
            ADD COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0);
        END IF;
        
        -- Ensure we have the unique constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE table_name = 'service_supplies' 
                       AND constraint_type = 'UNIQUE') THEN
            ALTER TABLE public.service_supplies 
            ADD CONSTRAINT service_supplies_unique UNIQUE(service_id, supply_id);
        END IF;
    END IF;
END $$;

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

-- Success message
SELECT 'Migration completed successfully!' as status;