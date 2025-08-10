-- Migration: Sistema de categorías flexible con valores por defecto y personalizados

-- 1. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID, -- NULL para categorías del sistema, UUID para personalizadas
    entity_type VARCHAR(50) NOT NULL, -- 'service', 'supply', 'fixed_cost', etc.
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL, -- Nombre para mostrar
    is_system BOOLEAN DEFAULT false, -- true para categorías predefinidas
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Una categoría personalizada debe pertenecer a una clínica
    CONSTRAINT check_custom_category CHECK (
        (is_system = true AND clinic_id IS NULL) OR 
        (is_system = false AND clinic_id IS NOT NULL)
    ),
    
    -- No duplicar nombres dentro del mismo contexto
    UNIQUE(clinic_id, entity_type, name)
);

-- 2. Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_categories_clinic ON public.categories(clinic_id);
CREATE INDEX IF NOT EXISTS idx_categories_entity ON public.categories(entity_type);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);

-- 3. Insertar categorías por defecto para SERVICIOS
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('service', 'preventivo', 'Preventivo', true, 1),
    ('service', 'restaurativo', 'Restaurativo', true, 2),
    ('service', 'endodoncia', 'Endodoncia', true, 3),
    ('service', 'cirugia', 'Cirugía', true, 4),
    ('service', 'estetica', 'Estética', true, 5),
    ('service', 'ortodoncia', 'Ortodoncia', true, 6),
    ('service', 'protesis', 'Prótesis', true, 7),
    ('service', 'periodoncia', 'Periodoncia', true, 8),
    ('service', 'diagnostico', 'Diagnóstico', true, 9),
    ('service', 'emergencia', 'Emergencia', true, 10),
    ('service', 'otros', 'Otros', true, 99)
ON CONFLICT DO NOTHING;

-- 4. Insertar categorías por defecto para INSUMOS (SUPPLIES)
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('supply', 'insumo', 'Insumo Médico', true, 1),
    ('supply', 'bioseguridad', 'Bioseguridad', true, 2),
    ('supply', 'consumibles', 'Consumibles', true, 3),
    ('supply', 'materiales', 'Materiales', true, 4),
    ('supply', 'medicamentos', 'Medicamentos', true, 5),
    ('supply', 'equipos', 'Equipos', true, 6),
    ('supply', 'instrumental', 'Instrumental', true, 7),
    ('supply', 'laboratorio', 'Laboratorio', true, 8),
    ('supply', 'otros', 'Otros', true, 99)
ON CONFLICT DO NOTHING;

-- 5. Insertar categorías por defecto para COSTOS FIJOS
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('fixed_cost', 'rent', 'Alquiler', true, 1),
    ('fixed_cost', 'utilities', 'Servicios', true, 2),
    ('fixed_cost', 'salaries', 'Salarios', true, 3),
    ('fixed_cost', 'insurance', 'Seguros', true, 4),
    ('fixed_cost', 'maintenance', 'Mantenimiento', true, 5),
    ('fixed_cost', 'marketing', 'Marketing', true, 6),
    ('fixed_cost', 'administrative', 'Administrativo', true, 7),
    ('fixed_cost', 'taxes', 'Impuestos', true, 8),
    ('fixed_cost', 'otros', 'Otros', true, 99)
ON CONFLICT DO NOTHING;

-- 6. Insertar categorías por defecto para ACTIVOS
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('asset', 'equipment', 'Equipo Dental', true, 1),
    ('asset', 'furniture', 'Mobiliario', true, 2),
    ('asset', 'technology', 'Tecnología', true, 3),
    ('asset', 'instruments', 'Instrumental', true, 4),
    ('asset', 'infrastructure', 'Infraestructura', true, 5),
    ('asset', 'vehicle', 'Vehículos', true, 6),
    ('asset', 'otros', 'Otros', true, 99)
ON CONFLICT DO NOTHING;

-- 7. Eliminar el constraint antiguo de categorías en services
ALTER TABLE public.services 
DROP CONSTRAINT IF EXISTS services_category_check;

-- 8. Función para obtener categorías (sistema + personalizadas de la clínica)
CREATE OR REPLACE FUNCTION get_categories_for_clinic(
    p_clinic_id UUID,
    p_entity_type VARCHAR(50)
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    display_name VARCHAR(100),
    is_system BOOLEAN,
    display_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.display_name,
        c.is_system,
        c.display_order
    FROM public.categories c
    WHERE 
        c.entity_type = p_entity_type
        AND c.is_active = true
        AND (
            c.is_system = true -- Categorías del sistema
            OR c.clinic_id = p_clinic_id -- Categorías personalizadas de la clínica
        )
    ORDER BY c.display_order, c.display_name;
END;
$$ LANGUAGE plpgsql;

-- 9. Vista para facilitar el acceso a categorías
CREATE OR REPLACE VIEW public.v_categories AS
SELECT 
    c.*,
    CASE 
        WHEN c.is_system THEN 'Sistema'
        ELSE 'Personalizada'
    END as category_type
FROM public.categories c
WHERE c.is_active = true;

-- 10. Comentarios
COMMENT ON TABLE public.categories IS 'Categorías flexibles para todas las entidades del sistema';
COMMENT ON COLUMN public.categories.entity_type IS 'Tipo de entidad: service, supply, fixed_cost, asset, etc.';
COMMENT ON COLUMN public.categories.is_system IS 'true = categoría predefinida del sistema, false = creada por usuario';
COMMENT ON FUNCTION get_categories_for_clinic IS 'Obtiene categorías del sistema + personalizadas de una clínica';

-- Success
SELECT 'Migración completada: Sistema de categorías flexible implementado' as status;