-- =================================================================
-- SCRIPT ÚNICO Y COMPLETO V3: Fix de Onboarding
-- =================================================================
-- Este script hace TODO en un solo paso y muestra TODO al final
-- =================================================================

-- Variables para almacenar resultados
CREATE TEMP TABLE IF NOT EXISTS diagnostico_final (
    orden INT,
    paso TEXT,
    estado TEXT,
    detalle TEXT
);

-- PASO 1: Verificar y poblar category_types
DO $$
DECLARE
    v_count INT;
BEGIN
    -- Verificar cuántos hay
    SELECT COUNT(*) INTO v_count FROM category_types;
    INSERT INTO diagnostico_final VALUES (1, '1. category_types inicial', '📊', v_count || ' registros encontrados');

    -- Agregar UNIQUE constraint si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'category_types_name_key'
    ) THEN
        ALTER TABLE category_types ADD CONSTRAINT category_types_name_key UNIQUE (name);
        INSERT INTO diagnostico_final VALUES (2, '1. UNIQUE constraint', '✅', 'Agregado a category_types.name');
    ELSE
        INSERT INTO diagnostico_final VALUES (2, '1. UNIQUE constraint', 'ℹ️', 'Ya existe');
    END IF;

    -- Insertar datos
    INSERT INTO category_types (name, display_name) VALUES
        ('service', 'Categorías de Servicios'),
        ('supply', 'Categorías de Insumos'),
        ('fixed_cost', 'Categorías de Costos Fijos'),
        ('expense', 'Categorías de Gastos')
    ON CONFLICT (name) DO NOTHING;

    -- Verificar de nuevo
    SELECT COUNT(*) INTO v_count FROM category_types;
    INSERT INTO diagnostico_final VALUES (3, '1. category_types final', '✅', v_count || ' tipos disponibles');
END $$;

-- PASO 2: Habilitar RLS
ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_types ENABLE ROW LEVEL SECURITY;

INSERT INTO diagnostico_final VALUES (4, '2. RLS', '✅', 'Habilitado en 3 tablas');

-- PASO 3: Crear políticas RLS
DROP POLICY IF EXISTS "Users can view patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can view patient sources in their clinics" ON public.patient_sources
  FOR SELECT USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can insert patient sources in their clinics" ON public.patient_sources
  FOR INSERT WITH CHECK (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can update patient sources in their clinics" ON public.patient_sources
  FOR UPDATE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete custom patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can delete custom patient sources in their clinics" ON public.patient_sources
  FOR DELETE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "Users can view categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can view categories in their clinics" ON public.custom_categories
  FOR SELECT USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can insert categories in their clinics" ON public.custom_categories
  FOR INSERT WITH CHECK (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can update categories in their clinics" ON public.custom_categories
  FOR UPDATE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete custom categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can delete custom categories in their clinics" ON public.custom_categories
  FOR DELETE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()) AND is_system = false);

DROP POLICY IF EXISTS "Authenticated users can view category types" ON public.category_types;
CREATE POLICY "Authenticated users can view category types" ON public.category_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO diagnostico_final VALUES (5, '3. Políticas RLS', '✅', '9 políticas creadas');

-- PASO 4: CRÍTICO - Modificar funciones a SECURITY DEFINER
CREATE OR REPLACE FUNCTION insert_default_patient_sources()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION insert_default_categories()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  service_type_id UUID;
  supply_type_id UUID;
  fixed_cost_type_id UUID;
BEGIN
  SELECT id INTO service_type_id FROM category_types WHERE name = 'service';
  SELECT id INTO supply_type_id FROM category_types WHERE name = 'supply';
  SELECT id INTO fixed_cost_type_id FROM category_types WHERE name = 'fixed_cost';

  IF service_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "service" no encontrado';
  END IF;
  IF supply_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "supply" no encontrado';
  END IF;
  IF fixed_cost_type_id IS NULL THEN
    RAISE EXCEPTION 'category_type "fixed_cost" no encontrado';
  END IF;

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

  INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
    (NEW.id, supply_type_id, 'insumo', 'Insumo', true, 1),
    (NEW.id, supply_type_id, 'bioseguridad', 'Bioseguridad', true, 2),
    (NEW.id, supply_type_id, 'consumibles', 'Consumibles', true, 3),
    (NEW.id, supply_type_id, 'materiales', 'Materiales', true, 4),
    (NEW.id, supply_type_id, 'medicamentos', 'Medicamentos', true, 5),
    (NEW.id, supply_type_id, 'equipos', 'Equipos', true, 6),
    (NEW.id, supply_type_id, 'otros', 'Otros', true, 7);

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

INSERT INTO diagnostico_final VALUES (6, '4. Funciones trigger', '✅', 'Modificadas a SECURITY DEFINER');

-- PASO 5: Verificaciones finales
DO $$
DECLARE
    v_cat_types INT;
    v_policies INT;
    v_sec_definer BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_cat_types FROM category_types;
    SELECT COUNT(*) INTO v_policies FROM pg_policies WHERE tablename IN ('patient_sources', 'custom_categories', 'category_types');
    SELECT prosecdef INTO v_sec_definer FROM pg_proc WHERE proname = 'insert_default_categories';

    INSERT INTO diagnostico_final VALUES (7, '5. Verificación tipos',
        CASE WHEN v_cat_types >= 4 THEN '✅' ELSE '❌' END,
        v_cat_types || ' tipos en category_types');

    INSERT INTO diagnostico_final VALUES (8, '5. Verificación políticas',
        CASE WHEN v_policies >= 9 THEN '✅' ELSE '❌' END,
        v_policies || ' políticas RLS activas');

    INSERT INTO diagnostico_final VALUES (9, '5. Verificación SECURITY DEFINER',
        CASE WHEN v_sec_definer THEN '✅' ELSE '❌' END,
        CASE WHEN v_sec_definer THEN 'Funciones ejecutan como owner' ELSE 'PROBLEMA: aún INVOKER' END);
END $$;

-- =================================================================
-- MOSTRAR RESULTADOS FINALES
-- =================================================================

-- Diagnóstico
SELECT paso, estado, detalle FROM diagnostico_final ORDER BY orden;

-- Separador
SELECT '========================================' as separador;

-- Category types
SELECT 'CATEGORY_TYPES:' as info, name, display_name FROM category_types ORDER BY name;

-- Separador
SELECT '========================================' as separador;

-- Estado final
SELECT
    'ESTADO FINAL' as resultado,
    CASE
        WHEN (SELECT COUNT(*) FROM category_types) >= 4
        AND (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('patient_sources', 'custom_categories')) >= 8
        AND (SELECT prosecdef FROM pg_proc WHERE proname = 'insert_default_categories')
        THEN '✅ TODO LISTO - Onboarding debería funcionar'
        ELSE '❌ HAY PROBLEMAS - Revisar arriba'
    END as estado;

-- Limpiar
DROP TABLE diagnostico_final;
