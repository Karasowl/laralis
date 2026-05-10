-- Agregar campo notes a la tabla patients
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Comentario para documentar el campo
COMMENT ON COLUMN patients.notes IS 'Notas adicionales sobre el paciente';