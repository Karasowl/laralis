-- =====================================================
-- AUDITORÍA EN FORMATO JSON - MEJOR PARA SUPABASE
-- =====================================================

-- OPCIÓN 1: Obtener todo en formato JSON (copia y ejecuta)
SELECT json_build_object(
    'patients_columns', (
        SELECT json_agg(json_build_object(
            'column', column_name,
            'type', data_type,
            'nullable', is_nullable
        ))
        FROM information_schema.columns
        WHERE table_name = 'patients'
    ),
    'marketing_campaigns_columns', (
        SELECT json_agg(json_build_object(
            'column', column_name,
            'type', data_type,
            'nullable', is_nullable
        ))
        FROM information_schema.columns
        WHERE table_name = 'marketing_campaigns'
    ),
    'patient_sources_columns', (
        SELECT json_agg(json_build_object(
            'column', column_name,
            'type', data_type,
            'nullable', is_nullable
        ))
        FROM information_schema.columns
        WHERE table_name = 'patient_sources'
    ),
    'categories_columns', (
        SELECT json_agg(json_build_object(
            'column', column_name,
            'type', data_type,
            'nullable', is_nullable
        ))
        FROM information_schema.columns
        WHERE table_name = 'categories'
    ),
    'columns_check', json_build_object(
        'source_id_exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'source_id'),
        'acquisition_type_exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'acquisition_type'),
        'acquisition_details_exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'acquisition_details'),
        'platform_id_exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'platform_id'),
        'campaign_id_exists', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'campaign_id')
    ),
    'statistics', json_build_object(
        'total_patients', (SELECT COUNT(*) FROM patients),
        'with_source_id', (SELECT COUNT(*) FROM patients WHERE source_id IS NOT NULL),
        'with_campaign_id', (SELECT COUNT(*) FROM patients WHERE campaign_id IS NOT NULL),
        'total_campaigns', (SELECT COUNT(*) FROM marketing_campaigns),
        'total_sources', (SELECT COUNT(*) FROM patient_sources)
    )
) as audit_result;