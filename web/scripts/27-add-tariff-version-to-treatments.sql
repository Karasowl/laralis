-- Agregar columna tariff_version a treatments para rastrear qué versión de tarifa se usó
ALTER TABLE treatments 
ADD COLUMN IF NOT EXISTS tariff_version INTEGER;

-- Comentario para documentar el campo
COMMENT ON COLUMN treatments.tariff_version IS 'Versión de la tarifa usada al crear el tratamiento';

-- Si ya hay tratamientos, asignarles versión 1 por defecto
UPDATE treatments 
SET tariff_version = 1 
WHERE tariff_version IS NULL;