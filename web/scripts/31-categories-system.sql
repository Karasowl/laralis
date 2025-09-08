-- Script para crear el sistema de categorías configurables
-- Fecha: 2025-08-16
-- Descripción: Permite definir categorías personalizables para diferentes entidades del sistema

-- 1. Crear tabla de tipos de categorías (para saber qué tipos de categorías existen)
CREATE TABLE IF NOT EXISTS category_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- 'supplies', 'services', 'expenses', etc.
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7), -- Hex color
    is_system BOOLEAN DEFAULT FALSE, -- Categorías del sistema no se pueden eliminar
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(clinic_id, code)
);

-- 2. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    category_type_id UUID NOT NULL REFERENCES category_types(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- Para categorías jerárquicas
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7), -- Hex color
    display_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}', -- Para datos adicionales específicos del tipo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(clinic_id, category_type_id, code)
);

-- 3. Índices para mejorar el rendimiento
CREATE INDEX idx_category_types_clinic ON category_types(clinic_id);
CREATE INDEX idx_category_types_code ON category_types(code);
CREATE INDEX idx_categories_clinic ON categories(clinic_id);
CREATE INDEX idx_categories_type ON categories(category_type_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active);

-- 4. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_category_types_updated_at BEFORE UPDATE ON category_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Función para insertar categorías por defecto cuando se crea una clínica
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
DECLARE
    supplies_type_id UUID;
    services_type_id UUID;
    expenses_type_id UUID;
BEGIN
    -- Crear tipos de categorías por defecto
    INSERT INTO category_types (clinic_id, code, name, description, icon, color, is_system)
    VALUES 
        (NEW.id, 'supplies', 'Insumos', 'Categorías para insumos dentales', 'Package', '#3b82f6', TRUE),
        (NEW.id, 'services', 'Servicios', 'Categorías para servicios dentales', 'Activity', '#10b981', TRUE),
        (NEW.id, 'expenses', 'Gastos', 'Categorías para gastos y egresos', 'Receipt', '#ef4444', TRUE)
    RETURNING id INTO supplies_type_id, services_type_id, expenses_type_id;
    
    -- Obtener los IDs de los tipos creados
    SELECT id INTO supplies_type_id FROM category_types WHERE clinic_id = NEW.id AND code = 'supplies';
    SELECT id INTO services_type_id FROM category_types WHERE clinic_id = NEW.id AND code = 'services';
    SELECT id INTO expenses_type_id FROM category_types WHERE clinic_id = NEW.id AND code = 'expenses';
    
    -- Crear categorías por defecto para insumos
    INSERT INTO categories (clinic_id, category_type_id, code, name, description, color, display_order, is_system)
    VALUES 
        (NEW.id, supplies_type_id, 'materials', 'Materiales', 'Materiales dentales generales', '#3b82f6', 1, TRUE),
        (NEW.id, supplies_type_id, 'instruments', 'Instrumental', 'Instrumental y herramientas', '#8b5cf6', 2, TRUE),
        (NEW.id, supplies_type_id, 'medications', 'Medicamentos', 'Medicamentos y anestésicos', '#ec4899', 3, TRUE),
        (NEW.id, supplies_type_id, 'disposables', 'Desechables', 'Materiales desechables', '#f59e0b', 4, TRUE),
        (NEW.id, supplies_type_id, 'lab', 'Laboratorio', 'Materiales de laboratorio', '#14b8a6', 5, TRUE);
    
    -- Crear categorías por defecto para servicios  
    INSERT INTO categories (clinic_id, category_type_id, code, name, description, color, display_order, is_system)
    VALUES 
        (NEW.id, services_type_id, 'preventive', 'Preventiva', 'Servicios preventivos', '#10b981', 1, TRUE),
        (NEW.id, services_type_id, 'restorative', 'Restaurativa', 'Odontología restaurativa', '#3b82f6', 2, TRUE),
        (NEW.id, services_type_id, 'endodontics', 'Endodoncia', 'Tratamientos de conducto', '#8b5cf6', 3, TRUE),
        (NEW.id, services_type_id, 'periodontics', 'Periodoncia', 'Tratamiento de encías', '#ec4899', 4, TRUE),
        (NEW.id, services_type_id, 'surgery', 'Cirugía', 'Cirugía oral', '#ef4444', 5, TRUE),
        (NEW.id, services_type_id, 'orthodontics', 'Ortodoncia', 'Tratamientos de ortodoncia', '#f59e0b', 6, TRUE),
        (NEW.id, services_type_id, 'prosthetics', 'Prótesis', 'Prótesis dentales', '#14b8a6', 7, TRUE),
        (NEW.id, services_type_id, 'aesthetics', 'Estética', 'Odontología estética', '#a855f7', 8, TRUE);
    
    -- Crear categorías por defecto para gastos
    INSERT INTO categories (clinic_id, category_type_id, code, name, description, color, display_order, is_system)
    VALUES 
        (NEW.id, expenses_type_id, 'rent', 'Renta', 'Renta del consultorio', '#ef4444', 1, TRUE),
        (NEW.id, expenses_type_id, 'utilities', 'Servicios', 'Agua, luz, internet, etc.', '#f59e0b', 2, TRUE),
        (NEW.id, expenses_type_id, 'salaries', 'Sueldos', 'Sueldos y prestaciones', '#3b82f6', 3, TRUE),
        (NEW.id, expenses_type_id, 'supplies_purchase', 'Compra Insumos', 'Compra de materiales', '#10b981', 4, TRUE),
        (NEW.id, expenses_type_id, 'equipment', 'Equipo', 'Compra y mantenimiento de equipo', '#8b5cf6', 5, TRUE),
        (NEW.id, expenses_type_id, 'marketing', 'Marketing', 'Publicidad y marketing', '#ec4899', 6, TRUE),
        (NEW.id, expenses_type_id, 'other', 'Otros', 'Otros gastos', '#6b7280', 7, TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para crear categorías por defecto al crear una clínica
CREATE TRIGGER create_clinic_default_categories
    AFTER INSERT ON clinics
    FOR EACH ROW
    EXECUTE FUNCTION create_default_categories();

-- 7. Actualizar tablas existentes para usar las nuevas categorías
-- Primero agregamos las columnas si no existen
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- 8. Función para migrar categorías existentes (hardcodeadas) a la nueva estructura
CREATE OR REPLACE FUNCTION migrate_existing_categories()
RETURNS void AS $$
DECLARE
    clinic_record RECORD;
    supplies_type_id UUID;
    services_type_id UUID;
    supply_record RECORD;
    service_record RECORD;
BEGIN
    -- Para cada clínica existente
    FOR clinic_record IN SELECT id FROM clinics LOOP
        -- Verificar si ya tiene categorías
        IF NOT EXISTS (SELECT 1 FROM category_types WHERE clinic_id = clinic_record.id) THEN
            -- Crear los tipos de categorías
            INSERT INTO category_types (clinic_id, code, name, description, icon, color, is_system)
            VALUES 
                (clinic_record.id, 'supplies', 'Insumos', 'Categorías para insumos dentales', 'Package', '#3b82f6', TRUE),
                (clinic_record.id, 'services', 'Servicios', 'Categorías para servicios dentales', 'Activity', '#10b981', TRUE),
                (clinic_record.id, 'expenses', 'Gastos', 'Categorías para gastos y egresos', 'Receipt', '#ef4444', TRUE);
            
            -- Obtener los IDs
            SELECT id INTO supplies_type_id FROM category_types WHERE clinic_id = clinic_record.id AND code = 'supplies';
            SELECT id INTO services_type_id FROM category_types WHERE clinic_id = clinic_record.id AND code = 'services';
            
            -- Crear categorías basadas en las categorías existentes en supplies
            FOR supply_record IN 
                SELECT DISTINCT category FROM supplies WHERE clinic_id = clinic_record.id AND category IS NOT NULL 
            LOOP
                INSERT INTO categories (clinic_id, category_type_id, code, name, is_system)
                VALUES (clinic_record.id, supplies_type_id, 
                        LOWER(REPLACE(supply_record.category, ' ', '_')), 
                        supply_record.category, FALSE)
                ON CONFLICT DO NOTHING;
            END LOOP;
            
            -- Crear categorías basadas en las categorías existentes en services
            FOR service_record IN 
                SELECT DISTINCT category FROM services WHERE clinic_id = clinic_record.id AND category IS NOT NULL 
            LOOP
                INSERT INTO categories (clinic_id, category_type_id, code, name, is_system)
                VALUES (clinic_record.id, services_type_id, 
                        LOWER(REPLACE(service_record.category, ' ', '_')), 
                        service_record.category, FALSE)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la migración
SELECT migrate_existing_categories();

-- 9. RLS (Row Level Security) para las nuevas tablas
ALTER TABLE category_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Políticas para category_types
CREATE POLICY "Users can view their clinic category types" ON category_types
    FOR SELECT USING (
        clinic_id IN (
            SELECT clinic_id FROM clinic_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage their clinic category types" ON category_types
    FOR ALL USING (
        clinic_id IN (
            SELECT clinic_id FROM clinic_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )
    );

-- Políticas para categories
CREATE POLICY "Users can view their clinic categories" ON categories
    FOR SELECT USING (
        clinic_id IN (
            SELECT clinic_id FROM clinic_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage their clinic categories" ON categories
    FOR ALL USING (
        clinic_id IN (
            SELECT clinic_id FROM clinic_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )
    );

-- 10. Vistas útiles para facilitar el acceso
CREATE OR REPLACE VIEW v_categories_with_type AS
SELECT 
    c.*,
    ct.code as type_code,
    ct.name as type_name,
    ct.icon as type_icon,
    ct.color as type_color
FROM categories c
JOIN category_types ct ON c.category_type_id = ct.id
WHERE c.is_active = TRUE AND ct.is_active = TRUE;

-- Comentarios
COMMENT ON TABLE category_types IS 'Define los tipos de categorías disponibles en el sistema (insumos, servicios, gastos, etc.)';
COMMENT ON TABLE categories IS 'Categorías configurables para diferentes entidades del sistema';
COMMENT ON COLUMN categories.metadata IS 'Datos adicionales en JSON para flexibilidad futura';