-- Agregar columna owner_id a la tabla workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Crear índice para mejorar performance en consultas por owner_id
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- Agregar constraint para asegurar que solo el owner puede tener acceso
-- (esto se manejará principalmente en el código de aplicación, pero podemos agregar una política RLS más tarde)

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'workspaces' AND column_name = 'owner_id';