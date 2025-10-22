-- Seed de Datos Demo para Marketing Dashboard
-- Fecha: 2025-10-21
-- Propósito: Poblar la base de datos con datos realistas para demostrar
--            las funcionalidades del dashboard de marketing

-- IMPORTANTE: Este script asume que ya existe al menos 1 clínica activa
-- Ejecutar DESPUÉS de completar el onboarding

-- ============================================================================
-- VARIABLES: Obtener IDs necesarios
-- ============================================================================

DO $$
DECLARE
  v_clinic_id UUID;
  v_marketing_category_id UUID;
  v_source_direct_id UUID;
  v_source_referral_id UUID;
  v_source_social_id UUID;
  v_source_google_id UUID;
  v_service_id UUID;
  v_patient_record RECORD;
  i INTEGER;
  patient_counter INTEGER := 0;
BEGIN
  -- Obtener la primera clínica activa
  SELECT id INTO v_clinic_id
  FROM public.clinics
  WHERE is_active = true
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ninguna clínica activa. Completa el onboarding primero.';
  END IF;

  RAISE NOTICE 'Usando clínica: %', v_clinic_id;

  -- Obtener ID de categoría Marketing
  SELECT id INTO v_marketing_category_id
  FROM public.categories
  WHERE name = 'marketing' AND is_system = true
  LIMIT 1;

  IF v_marketing_category_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la categoría Marketing. Ejecuta migración 37 primero.';
  END IF;

  -- Obtener IDs de patient_sources
  SELECT id INTO v_source_direct_id FROM public.patient_sources WHERE clinic_id = v_clinic_id AND name = 'direct' LIMIT 1;
  SELECT id INTO v_source_referral_id FROM public.patient_sources WHERE clinic_id = v_clinic_id AND name = 'referral' LIMIT 1;
  SELECT id INTO v_source_social_id FROM public.patient_sources WHERE clinic_id = v_clinic_id AND name = 'social_media' LIMIT 1;
  SELECT id INTO v_source_google_id FROM public.patient_sources WHERE clinic_id = v_clinic_id AND name = 'google' LIMIT 1;

  -- Obtener un servicio existente
  SELECT id INTO v_service_id
  FROM public.services
  WHERE clinic_id = v_clinic_id AND is_active = true
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún servicio. Crea al menos 1 servicio primero.';
  END IF;

  -- ============================================================================
  -- 1. GASTOS DE MARKETING (últimos 6 meses)
  -- ============================================================================

  RAISE NOTICE 'Creando gastos de marketing...';

  -- Mes actual
  INSERT INTO public.expenses (clinic_id, category, category_id, expense_date, description, amount_cents, vendor)
  VALUES
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '5 days', 'Facebook Ads - Campaña Ortodoncia', 75000, 'Meta Platforms'),
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '15 days', 'Google Ads - Búsqueda Local', 120000, 'Google LLC');

  -- Mes -1
  INSERT INTO public.expenses (clinic_id, category, category_id, expense_date, description, amount_cents, vendor)
  VALUES
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '35 days', 'Facebook Ads', 80000, 'Meta Platforms'),
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '45 days', 'Volantes impresos', 15000, 'Imprenta Local');

  -- Mes -2
  INSERT INTO public.expenses (clinic_id, category, category_id, expense_date, description, amount_cents, vendor)
  VALUES
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '65 days', 'Google Ads', 100000, 'Google LLC'),
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '70 days', 'Instagram Ads', 60000, 'Meta Platforms');

  -- Mes -3
  INSERT INTO public.expenses (clinic_id, category, category_id, expense_date, description, amount_cents, vendor)
  VALUES
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '95 days', 'Facebook Ads', 90000, 'Meta Platforms'),
    (v_clinic_id, 'marketing', v_marketing_category_id, CURRENT_DATE - INTERVAL '105 days', 'Diseño de banner', 25000, 'Diseñador Freelance');

  RAISE NOTICE 'Gastos de marketing creados: 8 registros';

  -- ============================================================================
  -- 2. PACIENTES con diferentes fuentes (últimos 3 meses)
  -- ============================================================================

  RAISE NOTICE 'Creando pacientes de demo...';

  -- Pacientes de Directo (5 pacientes)
  FOR i IN 1..5 LOOP
    INSERT INTO public.patients (
      clinic_id, source_id, first_name, last_name, email, phone,
      created_at, acquisition_date
    ) VALUES (
      v_clinic_id, v_source_direct_id,
      'Paciente', 'Directo-' || i,
      'directo' || i || '@example.com',
      '+52155500' || LPAD(i::text, 4, '0'),
      CURRENT_TIMESTAMP - (INTERVAL '1 day' * (i * 10)),
      (CURRENT_DATE - (i * 10))
    );
  END LOOP;

  -- Pacientes de Referidos (8 pacientes)
  FOR i IN 1..8 LOOP
    INSERT INTO public.patients (
      clinic_id, source_id, first_name, last_name, email, phone,
      created_at, acquisition_date
    ) VALUES (
      v_clinic_id, v_source_referral_id,
      'Paciente', 'Referido-' || i,
      'referido' || i || '@example.com',
      '+52155501' || LPAD(i::text, 3, '0'),
      CURRENT_TIMESTAMP - (INTERVAL '1 day' * (i * 7)),
      (CURRENT_DATE - (i * 7))
    );
  END LOOP;

  -- Pacientes de Redes Sociales (12 pacientes)
  FOR i IN 1..12 LOOP
    INSERT INTO public.patients (
      clinic_id, source_id, first_name, last_name, email, phone,
      created_at, acquisition_date
    ) VALUES (
      v_clinic_id, v_source_social_id,
      'Paciente', 'Social-' || i,
      'social' || i || '@example.com',
      '+52155502' || LPAD(i::text, 3, '0'),
      CURRENT_TIMESTAMP - (INTERVAL '1 day' * (i * 5)),
      (CURRENT_DATE - (i * 5))
    );
  END LOOP;

  -- Pacientes de Google (10 pacientes)
  FOR i IN 1..10 LOOP
    INSERT INTO public.patients (
      clinic_id, source_id, first_name, last_name, email, phone,
      created_at, acquisition_date
    ) VALUES (
      v_clinic_id, v_source_google_id,
      'Paciente', 'Google-' || i,
      'google' || i || '@example.com',
      '+52155503' || LPAD(i::text, 3, '0'),
      CURRENT_TIMESTAMP - (INTERVAL '1 day' * (i * 4)),
      (CURRENT_DATE - (i * 4))
    );
  END LOOP;

  RAISE NOTICE 'Pacientes creados: 35 registros';

  -- ============================================================================
  -- 3. TRATAMIENTOS COMPLETADOS (para calcular LTV e ingresos)
  -- ============================================================================

  RAISE NOTICE 'Creando tratamientos completados...';

  -- Crear tratamientos para aproximadamente 60% de los pacientes (21 de 35)
  -- Obtener los primeros 21 pacientes y crear tratamientos para ellos
  patient_counter := 0;
  FOR v_patient_record IN
    SELECT id, created_at
    FROM public.patients
    WHERE clinic_id = v_clinic_id
    ORDER BY created_at DESC
    LIMIT 21
  LOOP
    patient_counter := patient_counter + 1;

    INSERT INTO public.treatments (
      clinic_id, patient_id, service_id,
      treatment_date, minutes, status,
      fixed_cost_per_minute_cents, variable_cost_cents,
      margin_pct, price_cents
    ) VALUES (
      v_clinic_id, v_patient_record.id, v_service_id,
      (v_patient_record.created_at::date + INTERVAL '2 days')::date, -- 2 días después de registro
      CASE WHEN patient_counter % 3 = 0 THEN 60 ELSE 45 END, -- Variar duración
      'completed',
      88, -- Costo fijo por minuto (del cálculo anterior)
      CASE WHEN patient_counter % 2 = 0 THEN 5000 ELSE 3500 END, -- Variar costo variable
      65, -- 65% margen
      CASE
        WHEN patient_counter % 3 = 0 THEN 25000 -- $250
        WHEN patient_counter % 2 = 0 THEN 18000 -- $180
        ELSE 15000 -- $150
      END
    );
  END LOOP;

  RAISE NOTICE 'Tratamientos creados: % registros', patient_counter;

  -- ============================================================================
  -- RESUMEN FINAL
  -- ============================================================================

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED COMPLETADO EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Clínica ID: %', v_clinic_id;
  RAISE NOTICE 'Gastos de marketing: 8 (últimos 4 meses)';
  RAISE NOTICE 'Pacientes creados: 35';
  RAISE NOTICE '  - Directo: 5';
  RAISE NOTICE '  - Referidos: 8';
  RAISE NOTICE '  - Redes Sociales: 12';
  RAISE NOTICE '  - Google: 10';
  RAISE NOTICE 'Tratamientos completados: 21 (60%% conversión)';
  RAISE NOTICE '';
  RAISE NOTICE 'Métricas esperadas aproximadamente:';
  RAISE NOTICE '  - CAC: ~$14 USD (450,000 centavos / 35 pacientes)';
  RAISE NOTICE '  - LTV: ~$110 USD (promedio por paciente con tratamiento)';
  RAISE NOTICE '  - Conversion Rate: 60%%';
  RAISE NOTICE '  - LTV/CAC Ratio: ~7.8x (Excelente)';
  RAISE NOTICE '========================================';

END $$;

-- Verificar resultados
SELECT
  'Seed completado' as status,
  COUNT(*) as total_records
FROM (
  SELECT id FROM expenses WHERE category_id IN (SELECT id FROM categories WHERE name = 'marketing')
  UNION ALL
  SELECT id FROM patients WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '4 months'
  UNION ALL
  SELECT id FROM treatments WHERE status = 'completed'
) combined;
