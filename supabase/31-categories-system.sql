-- Script para crear el sistema de categorías configurables
-- Copiado desde web/scripts/31-categories-system.sql para ejecutarlo en Supabase

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
CREATE INDEX IF NOT EXISTS idx_category_types_clinic ON category_types(clinic_id);
CREATE INDEX IF NOT EXISTS idx_category_types_code ON category_types(code);
CREATE INDEX IF NOT EXISTS idx_categories_clinic ON categories(clinic_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(category_type_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- 4. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_category_types_updated_at'
  ) THEN
    CREATE TRIGGER update_category_types_updated_at BEFORE UPDATE ON category_types
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 5. Vista útil
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

