-- =====================================================
-- FIX: Hacer campos opcionales en workspace_members
-- =====================================================

-- Hacer que las columnas email, display_name, invitation_status y accepted_at sean opcionales
-- ya que estos campos no siempre están disponibles al crear el owner inicial

ALTER TABLE workspace_members 
ALTER COLUMN email DROP NOT NULL;

ALTER TABLE workspace_members 
ALTER COLUMN display_name DROP NOT NULL;

ALTER TABLE workspace_members 
ALTER COLUMN invitation_status DROP NOT NULL;

ALTER TABLE workspace_members 
ALTER COLUMN accepted_at DROP NOT NULL;

-- Verificar la estructura actualizada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'workspace_members'
ORDER BY ordinal_position;