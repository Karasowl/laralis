-- EJECUTA ESTO EN SUPABASE SQL EDITOR AHORA MISMO
-- Esto corrige todos los problemas de la tabla clinics

-- 1. Hacer org_id opcional (ya no lo necesitamos)
ALTER TABLE public.clinics 
ALTER COLUMN org_id DROP NOT NULL;

-- 2. Agregar las columnas que faltan
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Si hay datos existentes, copiar org_id a workspace_id
UPDATE public.clinics 
SET workspace_id = org_id 
WHERE workspace_id IS NULL AND org_id IS NOT NULL;

-- 4. Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_clinics_workspace ON public.clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clinics_active ON public.clinics(is_active);

-- Verificar que todo está bien
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clinics' 
AND table_schema = 'public'
ORDER BY ordinal_position;