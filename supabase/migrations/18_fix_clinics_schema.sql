-- Migration: Corregir esquema de clinics para usar workspace_id en lugar de org_id
-- Este cambio es necesario porque cambiamos de organizations a workspaces

-- 1. Primero, hacer org_id nullable temporalmente
ALTER TABLE public.clinics 
ALTER COLUMN org_id DROP NOT NULL;

-- 2. Agregar workspace_id si no existe
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3. Agregar campos adicionales necesarios
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Migrar datos existentes si hay alguno (asumiendo que org_id puede mapear a workspace_id)
UPDATE public.clinics 
SET workspace_id = org_id 
WHERE workspace_id IS NULL AND org_id IS NOT NULL;

-- 5. Para nuevos registros, hacer workspace_id requerido
ALTER TABLE public.clinics 
ALTER COLUMN workspace_id SET NOT NULL;

-- 6. Crear índices necesarios
CREATE INDEX IF NOT EXISTS idx_clinics_workspace ON public.clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clinics_email ON public.clinics(email);
CREATE INDEX IF NOT EXISTS idx_clinics_active ON public.clinics(is_active);

-- 7. Eventualmente podríamos eliminar org_id, pero lo dejamos por ahora para compatibilidad
-- ALTER TABLE public.clinics DROP COLUMN org_id;

-- Success
SELECT 'Migración completada: Tabla clinics actualizada para usar workspace_id' as status;