-- Migration: Agregar campos faltantes a clinics
-- Estos campos son necesarios para el módulo de onboarding y gestión de clínicas

-- Agregar columnas que faltan en la tabla clinics
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Actualizar índices si es necesario
CREATE INDEX IF NOT EXISTS idx_clinics_email ON public.clinics(email);

-- Success
SELECT 'Migración completada: Campos address, phone y email agregados a clinics' as status;