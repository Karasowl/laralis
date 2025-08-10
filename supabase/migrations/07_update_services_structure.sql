-- Migration: Update existing services tables to match new requirements

-- 1. Update services table - add missing columns
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'otros',
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Copy est_minutes to duration_minutes if needed
UPDATE public.services 
SET duration_minutes = est_minutes
WHERE duration_minutes IS NULL;

-- 3. Make duration_minutes NOT NULL with proper default
ALTER TABLE public.services 
ALTER COLUMN duration_minutes SET NOT NULL,
ALTER COLUMN duration_minutes SET DEFAULT 30;

-- 4. Add category constraint
ALTER TABLE public.services 
DROP CONSTRAINT IF EXISTS services_category_check;

ALTER TABLE public.services 
ADD CONSTRAINT services_category_check 
CHECK (category IN ('preventivo', 'restaurativo', 'endodoncia', 'cirugia', 'estetica', 'ortodoncia', 'protesis', 'periodoncia', 'otros'));

-- 5. Add duration constraint
ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_duration_minutes_check;

ALTER TABLE public.services
ADD CONSTRAINT services_duration_minutes_check
CHECK (duration_minutes > 0);

-- 6. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- 7. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 8. Add comments
COMMENT ON TABLE public.services IS 'Dental services catalog with duration and category';
COMMENT ON COLUMN public.services.est_minutes IS 'DEPRECATED - Use duration_minutes instead';
COMMENT ON COLUMN public.services.duration_minutes IS 'Estimated duration of the service in minutes';
COMMENT ON COLUMN public.services.category IS 'Service category for classification';

-- Note: service_supplies table already exists with correct structure (qty column)
-- Our API will use 'qty' to match the existing database structure

-- Success
SELECT 'Migration completed! Services table updated with new columns.' as status;