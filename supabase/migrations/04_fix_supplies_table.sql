-- Migration: Fix supplies table - add missing columns and constraints

-- Add updated_at column to supplies
ALTER TABLE public.supplies 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Make category NOT NULL with default
ALTER TABLE public.supplies 
ALTER COLUMN category SET DEFAULT 'otros';

-- Update existing NULL categories to 'otros'
UPDATE public.supplies 
SET category = 'otros' 
WHERE category IS NULL;

-- Make category NOT NULL
ALTER TABLE public.supplies 
ALTER COLUMN category SET NOT NULL;

-- Make presentation NOT NULL with default empty string
ALTER TABLE public.supplies 
ALTER COLUMN presentation SET DEFAULT '';

-- Update existing NULL presentations to empty string
UPDATE public.supplies 
SET presentation = '' 
WHERE presentation IS NULL;

-- Make presentation NOT NULL
ALTER TABLE public.supplies 
ALTER COLUMN presentation SET NOT NULL;

-- Add check constraint for valid categories
ALTER TABLE public.supplies 
ADD CONSTRAINT check_supply_category 
CHECK (category IN ('insumo', 'bioseguridad', 'consumibles', 'materiales', 'medicamentos', 'equipos', 'otros'));

-- Add trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supplies_updated_at 
BEFORE UPDATE ON public.supplies 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();