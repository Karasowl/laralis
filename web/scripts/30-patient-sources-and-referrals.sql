-- Tabla para las vías/fuentes de llegada de pacientes
CREATE TABLE IF NOT EXISTS patient_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- Para diferenciar las vías del sistema de las personalizadas
  color VARCHAR(7), -- Color hexadecimal para gráficos
  icon VARCHAR(50), -- Nombre del icono para UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, name)
);

-- Agregar campo de vía de llegada a pacientes
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES patient_sources(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referred_by_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS acquisition_date DATE, -- Fecha en que llegó por primera vez
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false, -- Si es paciente recurrente
ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(200); -- Si vino de una campaña específica

-- Índices para mejorar performance en consultas
CREATE INDEX IF NOT EXISTS idx_patients_source_id ON patients(source_id);
CREATE INDEX IF NOT EXISTS idx_patients_referred_by ON patients(referred_by_patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_date ON patients(acquisition_date);
CREATE INDEX IF NOT EXISTS idx_patient_sources_clinic_id ON patient_sources(clinic_id);

-- Tabla para categorías personalizables (servicios, insumos, etc)
CREATE TABLE IF NOT EXISTS category_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'service', 'supply', 'fixed_cost', etc
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para las categorías personalizables
CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category_type_id UUID NOT NULL REFERENCES category_types(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- Para diferenciar categorías del sistema de las personalizadas
  color VARCHAR(7), -- Color hexadecimal para UI
  icon VARCHAR(50), -- Nombre del icono
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, category_type_id, name)
);

-- Índices para categorías
CREATE INDEX IF NOT EXISTS idx_custom_categories_clinic_id ON custom_categories(clinic_id);
CREATE INDEX IF NOT EXISTS idx_custom_categories_type_id ON custom_categories(category_type_id);

-- Insertar tipos de categorías básicos
INSERT INTO category_types (name, display_name) VALUES
  ('service', 'Categorías de Servicios'),
  ('supply', 'Categorías de Insumos'),
  ('fixed_cost', 'Categorías de Costos Fijos'),
  ('expense', 'Categorías de Gastos')
ON CONFLICT (name) DO NOTHING;

-- Función para insertar vías de llegada por defecto para cada clínica
CREATE OR REPLACE FUNCTION insert_default_patient_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar vías por defecto cuando se crea una nueva clínica
  INSERT INTO patient_sources (clinic_id, name, description, is_system, color, icon) VALUES
    (NEW.id, 'Recomendación', 'Paciente referido por otro paciente', true, '#10B981', 'users'),
    (NEW.id, 'Google', 'Búsqueda en Google', true, '#4285F4', 'search'),
    (NEW.id, 'Facebook', 'Redes sociales - Facebook', true, '#1877F2', 'facebook'),
    (NEW.id, 'Instagram', 'Redes sociales - Instagram', true, '#E4405F', 'instagram'),
    (NEW.id, 'Página Web', 'Sitio web de la clínica', true, '#6366F1', 'globe'),
    (NEW.id, 'Walk-in', 'Paciente que llegó sin cita', true, '#F59E0B', 'door-open'),
    (NEW.id, 'Campaña', 'Campaña de marketing', true, '#EC4899', 'megaphone'),
    (NEW.id, 'Otro', 'Otra fuente', true, '#6B7280', 'dots-horizontal');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para insertar vías por defecto
DROP TRIGGER IF EXISTS insert_default_sources_on_clinic_create ON clinics;
CREATE TRIGGER insert_default_sources_on_clinic_create
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_patient_sources();

-- Función para insertar categorías por defecto para cada clínica
CREATE OR REPLACE FUNCTION insert_default_categories()
RETURNS TRIGGER AS $$
DECLARE
  service_type_id UUID;
  supply_type_id UUID;
  fixed_cost_type_id UUID;
BEGIN
  -- Obtener IDs de tipos
  SELECT id INTO service_type_id FROM category_types WHERE name = 'service';
  SELECT id INTO supply_type_id FROM category_types WHERE name = 'supply';
  SELECT id INTO fixed_cost_type_id FROM category_types WHERE name = 'fixed_cost';
  
  -- Insertar categorías de servicios por defecto
  INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
    (NEW.id, service_type_id, 'preventivo', 'Preventivo', true, 1),
    (NEW.id, service_type_id, 'restaurativo', 'Restaurativo', true, 2),
    (NEW.id, service_type_id, 'endodoncia', 'Endodoncia', true, 3),
    (NEW.id, service_type_id, 'cirugia', 'Cirugía', true, 4),
    (NEW.id, service_type_id, 'estetica', 'Estética', true, 5),
    (NEW.id, service_type_id, 'ortodoncia', 'Ortodoncia', true, 6),
    (NEW.id, service_type_id, 'protesis', 'Prótesis', true, 7),
    (NEW.id, service_type_id, 'periodoncia', 'Periodoncia', true, 8),
    (NEW.id, service_type_id, 'otros', 'Otros', true, 9);
  
  -- Insertar categorías de insumos por defecto
  INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
    (NEW.id, supply_type_id, 'insumo', 'Insumo', true, 1),
    (NEW.id, supply_type_id, 'bioseguridad', 'Bioseguridad', true, 2),
    (NEW.id, supply_type_id, 'consumibles', 'Consumibles', true, 3),
    (NEW.id, supply_type_id, 'materiales', 'Materiales', true, 4),
    (NEW.id, supply_type_id, 'medicamentos', 'Medicamentos', true, 5),
    (NEW.id, supply_type_id, 'equipos', 'Equipos', true, 6),
    (NEW.id, supply_type_id, 'otros', 'Otros', true, 7);
  
  -- Insertar categorías de costos fijos por defecto
  INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
    (NEW.id, fixed_cost_type_id, 'rent', 'Renta', true, 1),
    (NEW.id, fixed_cost_type_id, 'salaries', 'Salarios', true, 2),
    (NEW.id, fixed_cost_type_id, 'utilities', 'Servicios', true, 3),
    (NEW.id, fixed_cost_type_id, 'insurance', 'Seguros', true, 4),
    (NEW.id, fixed_cost_type_id, 'equipment', 'Equipamiento', true, 5),
    (NEW.id, fixed_cost_type_id, 'maintenance', 'Mantenimiento', true, 6),
    (NEW.id, fixed_cost_type_id, 'education', 'Educación', true, 7),
    (NEW.id, fixed_cost_type_id, 'advertising', 'Publicidad', true, 8),
    (NEW.id, fixed_cost_type_id, 'other', 'Otros', true, 9);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para insertar categorías por defecto
DROP TRIGGER IF EXISTS insert_default_categories_on_clinic_create ON clinics;
CREATE TRIGGER insert_default_categories_on_clinic_create
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_categories();

-- Insertar vías y categorías por defecto para clínicas existentes
DO $$
DECLARE
  clinic_record RECORD;
BEGIN
  FOR clinic_record IN SELECT id FROM clinics LOOP
    -- Verificar si ya tiene vías
    IF NOT EXISTS (SELECT 1 FROM patient_sources WHERE clinic_id = clinic_record.id) THEN
      -- Insertar vías por defecto
      INSERT INTO patient_sources (clinic_id, name, description, is_system, color, icon) VALUES
        (clinic_record.id, 'Recomendación', 'Paciente referido por otro paciente', true, '#10B981', 'users'),
        (clinic_record.id, 'Google', 'Búsqueda en Google', true, '#4285F4', 'search'),
        (clinic_record.id, 'Facebook', 'Redes sociales - Facebook', true, '#1877F2', 'facebook'),
        (clinic_record.id, 'Instagram', 'Redes sociales - Instagram', true, '#E4405F', 'instagram'),
        (clinic_record.id, 'Página Web', 'Sitio web de la clínica', true, '#6366F1', 'globe'),
        (clinic_record.id, 'Walk-in', 'Paciente que llegó sin cita', true, '#F59E0B', 'door-open'),
        (clinic_record.id, 'Campaña', 'Campaña de marketing', true, '#EC4899', 'megaphone'),
        (clinic_record.id, 'Otro', 'Otra fuente', true, '#6B7280', 'dots-horizontal');
    END IF;
    
    -- Las categorías se insertarán manualmente después si es necesario
  END LOOP;
END $$;

-- Vista para estadísticas de vías de pacientes
CREATE OR REPLACE VIEW patient_source_stats AS
SELECT 
  ps.clinic_id,
  ps.id as source_id,
  ps.name as source_name,
  ps.color,
  ps.icon,
  COUNT(DISTINCT p.id) as patient_count,
  COUNT(DISTINCT t.id) as treatment_count,
  COALESCE(SUM(t.price_cents), 0) as total_revenue_cents,
  COUNT(DISTINCT CASE WHEN p.acquisition_date >= CURRENT_DATE - INTERVAL '30 days' THEN p.id END) as new_patients_30d,
  COUNT(DISTINCT CASE WHEN p.is_recurring = true THEN p.id END) as recurring_patients
FROM patient_sources ps
LEFT JOIN patients p ON p.source_id = ps.id
LEFT JOIN treatments t ON t.patient_id = p.id
GROUP BY ps.id, ps.clinic_id, ps.name, ps.color, ps.icon;

-- Vista para red de referidos
CREATE OR REPLACE VIEW referral_network AS
SELECT 
  r.id as referrer_id,
  r.first_name || ' ' || r.last_name as referrer_name,
  COUNT(DISTINCT p.id) as referred_count,
  COALESCE(SUM(t.price_cents), 0) as referred_revenue_cents,
  ARRAY_AGG(DISTINCT p.first_name || ' ' || p.last_name) as referred_patients
FROM patients r
INNER JOIN patients p ON p.referred_by_patient_id = r.id
LEFT JOIN treatments t ON t.patient_id = p.id
GROUP BY r.id, r.first_name, r.last_name;

-- Comentarios para documentación
COMMENT ON TABLE patient_sources IS 'Vías o fuentes por las que llegan los pacientes a la clínica';
COMMENT ON TABLE custom_categories IS 'Categorías personalizables para servicios, insumos, costos, etc';
COMMENT ON COLUMN patients.source_id IS 'Vía por la que llegó el paciente';
COMMENT ON COLUMN patients.referred_by_patient_id IS 'ID del paciente que lo refirió';
COMMENT ON COLUMN patients.acquisition_date IS 'Fecha en que el paciente llegó por primera vez';
COMMENT ON COLUMN patients.is_recurring IS 'Indica si es un paciente recurrente';
COMMENT ON COLUMN patients.campaign_name IS 'Nombre de la campaña si vino por marketing';