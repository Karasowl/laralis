-- Agregar campo de fecha de primera cita a la tabla patients
ALTER TABLE patients 
ADD COLUMN first_visit_date DATE;

-- Comentario para documentación
COMMENT ON COLUMN patients.first_visit_date IS 'Fecha de la primera cita del paciente en la clínica';