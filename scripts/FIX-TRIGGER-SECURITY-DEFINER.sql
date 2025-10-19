-- =================================================================
-- FIX: Hacer que los triggers ejecuten como SECURITY DEFINER
-- =================================================================
-- PROBLEMA: Los triggers ejecutan como SECURITY INVOKER (contexto del usuario)
--           y RLS puede bloquear el acceso a category_types.
--
-- SOLUCIÓN: Modificar las funciones para que sean SECURITY DEFINER
--           (ejecutan con privilegios del owner, bypassean RLS)
-- =================================================================

-- PASO 1: Recrear función insert_default_patient_sources como SECURITY DEFINER
CREATE OR REPLACE FUNCTION insert_default_patient_sources()
RETURNS TRIGGER
SECURITY DEFINER  -- 🔑 ESTA ES LA CLAVE
SET search_path = public
LANGUAGE plpgsql AS $$
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
$$;

-- PASO 2: Recrear función insert_default_categories como SECURITY DEFINER
CREATE OR REPLACE FUNCTION insert_default_categories()
RETURNS TRIGGER
SECURITY DEFINER  -- 🔑 ESTA ES LA CLAVE
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  service_type_id UUID;
  supply_type_id UUID;
  fixed_cost_type_id UUID;
BEGIN
  -- Obtener IDs de tipos
  SELECT id INTO service_type_id FROM category_types WHERE name = 'service';
  SELECT id INTO supply_type_id FROM category_types WHERE name = 'supply';
  SELECT id INTO fixed_cost_type_id FROM category_types WHERE name = 'fixed_cost';

  -- Debug: Verificar que los IDs no sean NULL
  IF service_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "service" no encontrado en category_types';
  END IF;
  IF supply_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "supply" no encontrado en category_types';
  END IF;
  IF fixed_cost_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "fixed_cost" no encontrado en category_types';
  END IF;

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
$$;

-- PASO 3: Verificar que las funciones ahora sean SECURITY DEFINER
DO $$
DECLARE
    v_patient_sources_definer BOOLEAN;
    v_categories_definer BOOLEAN;
BEGIN
    SELECT prosecdef INTO v_patient_sources_definer
    FROM pg_proc
    WHERE proname = 'insert_default_patient_sources';

    SELECT prosecdef INTO v_categories_definer
    FROM pg_proc
    WHERE proname = 'insert_default_categories';

    IF v_patient_sources_definer THEN
        RAISE NOTICE '✅ insert_default_patient_sources es SECURITY DEFINER';
    ELSE
        RAISE WARNING '❌ insert_default_patient_sources NO es SECURITY DEFINER';
    END IF;

    IF v_categories_definer THEN
        RAISE NOTICE '✅ insert_default_categories es SECURITY DEFINER';
    ELSE
        RAISE WARNING '❌ insert_default_categories NO es SECURITY DEFINER';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FUNCIONES ACTUALIZADAS';
    RAISE NOTICE 'Ahora ejecutan con privilegios del owner';
    RAISE NOTICE 'Pueden leer category_types sin problemas de RLS';
    RAISE NOTICE '========================================';
END $$;
