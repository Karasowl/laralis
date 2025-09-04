-- =====================================================
-- AUDITORÍA COMPLETA DE BASE DE DATOS - RESULTADO EN TEXTO
-- =====================================================

-- Crear función temporal para formatear resultados
CREATE OR REPLACE FUNCTION temp_audit_database() 
RETURNS TABLE(audit_output TEXT) AS $$
BEGIN
    -- HEADER
    RETURN QUERY SELECT '========================================';
    RETURN QUERY SELECT 'AUDITORÍA COMPLETA DE BASE DE DATOS';
    RETURN QUERY SELECT 'Fecha: ' || NOW()::TEXT;
    RETURN QUERY SELECT '========================================';
    RETURN QUERY SELECT '';
    
    -- 1. TABLA PATIENTS
    RETURN QUERY SELECT '--- TABLA: patients ---';
    RETURN QUERY 
    SELECT FORMAT('  %s | %s | %s', 
        RPAD(column_name::TEXT, 30), 
        RPAD(data_type::TEXT, 20),
        is_nullable::TEXT)
    FROM information_schema.columns
    WHERE table_name = 'patients'
    ORDER BY ordinal_position;
    RETURN QUERY SELECT '';
    
    -- 2. TABLA MARKETING_CAMPAIGNS
    RETURN QUERY SELECT '--- TABLA: marketing_campaigns ---';
    RETURN QUERY 
    SELECT FORMAT('  %s | %s | %s', 
        RPAD(column_name::TEXT, 30), 
        RPAD(data_type::TEXT, 20),
        is_nullable::TEXT)
    FROM information_schema.columns
    WHERE table_name = 'marketing_campaigns'
    ORDER BY ordinal_position;
    RETURN QUERY SELECT '';
    
    -- 3. TABLA CATEGORIES
    RETURN QUERY SELECT '--- TABLA: categories ---';
    RETURN QUERY 
    SELECT FORMAT('  %s | %s | %s', 
        RPAD(column_name::TEXT, 30), 
        RPAD(data_type::TEXT, 20),
        is_nullable::TEXT)
    FROM information_schema.columns
    WHERE table_name = 'categories'
    ORDER BY ordinal_position;
    RETURN QUERY SELECT '';
    
    -- 4. TABLA PATIENT_SOURCES
    RETURN QUERY SELECT '--- TABLA: patient_sources ---';
    RETURN QUERY 
    SELECT FORMAT('  %s | %s | %s', 
        RPAD(column_name::TEXT, 30), 
        RPAD(data_type::TEXT, 20),
        is_nullable::TEXT)
    FROM information_schema.columns
    WHERE table_name = 'patient_sources'
    ORDER BY ordinal_position;
    RETURN QUERY SELECT '';
    
    -- 5. TABLA CLINICS
    RETURN QUERY SELECT '--- TABLA: clinics ---';
    RETURN QUERY 
    SELECT FORMAT('  %s | %s | %s', 
        RPAD(column_name::TEXT, 30), 
        RPAD(data_type::TEXT, 20),
        is_nullable::TEXT)
    FROM information_schema.columns
    WHERE table_name = 'clinics'
    ORDER BY ordinal_position;
    RETURN QUERY SELECT '';
    
    -- 6. FOREIGN KEYS DE PATIENTS
    RETURN QUERY SELECT '--- FOREIGN KEYS en patients ---';
    RETURN QUERY
    SELECT FORMAT('  %s -> %s.%s',
        RPAD(kcu.column_name::TEXT, 30),
        ccu.table_name::TEXT,
        ccu.column_name::TEXT)
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'patients'
        AND tc.constraint_type = 'FOREIGN KEY';
    RETURN QUERY SELECT '';
    
    -- 7. VISTAS RELACIONADAS
    RETURN QUERY SELECT '--- VISTAS que usan patients ---';
    RETURN QUERY
    SELECT '  ' || table_name::TEXT
    FROM information_schema.views
    WHERE view_definition LIKE '%patients%'
    ORDER BY table_name;
    RETURN QUERY SELECT '';
    
    -- 8. ÍNDICES EN PATIENTS
    RETURN QUERY SELECT '--- ÍNDICES en patients ---';
    RETURN QUERY
    SELECT '  ' || indexname::TEXT
    FROM pg_indexes
    WHERE tablename = 'patients';
    RETURN QUERY SELECT '';
    
    -- 9. TRIGGERS EN PATIENTS
    RETURN QUERY SELECT '--- TRIGGERS en patients ---';
    RETURN QUERY
    SELECT '  ' || trigger_name::TEXT || ' (' || event_manipulation::TEXT || ')'
    FROM information_schema.triggers
    WHERE event_object_table = 'patients';
    RETURN QUERY SELECT '';
    
    -- 10. VERIFICAR COLUMNAS ESPECÍFICAS
    RETURN QUERY SELECT '--- VERIFICACIÓN DE COLUMNAS ---';
    RETURN QUERY
    SELECT '  source_id existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'source_id'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY
    SELECT '  acquisition_type existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'acquisition_type'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY
    SELECT '  acquisition_details existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'acquisition_details'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY
    SELECT '  platform_id existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'platform_id'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY
    SELECT '  campaign_id existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'campaign_id'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY
    SELECT '  referred_by_patient_id existe: ' || 
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'referred_by_patient_id'
        ) THEN 'SÍ' ELSE 'NO' END;
    RETURN QUERY SELECT '';
    
    -- 11. ESTADÍSTICAS
    RETURN QUERY SELECT '--- ESTADÍSTICAS ---';
    RETURN QUERY
    SELECT '  Total pacientes: ' || COUNT(*)::TEXT FROM patients;
    RETURN QUERY
    SELECT '  Pacientes con source_id: ' || COUNT(*)::TEXT FROM patients WHERE source_id IS NOT NULL;
    RETURN QUERY
    SELECT '  Pacientes con campaign_id: ' || COUNT(*)::TEXT FROM patients WHERE campaign_id IS NOT NULL;
    RETURN QUERY
    SELECT '  Pacientes con referred_by: ' || COUNT(*)::TEXT FROM patients WHERE referred_by_patient_id IS NOT NULL;
    RETURN QUERY
    SELECT '  Total campañas: ' || COUNT(*)::TEXT FROM marketing_campaigns;
    RETURN QUERY
    SELECT '  Total sources: ' || COUNT(*)::TEXT FROM patient_sources;
    RETURN QUERY SELECT '';
    
    -- 12. MUESTRA DE patient_sources
    RETURN QUERY SELECT '--- MUESTRA DE patient_sources (max 5) ---';
    RETURN QUERY
    SELECT FORMAT('  ID: %s | Name: %s | Clinic: %s', 
        LEFT(id::TEXT, 8), 
        COALESCE(name, 'NULL'),
        LEFT(clinic_id::TEXT, 8))
    FROM patient_sources
    LIMIT 5;
    RETURN QUERY SELECT '';
    
    -- 13. MUESTRA DE marketing_campaigns  
    RETURN QUERY SELECT '--- MUESTRA DE marketing_campaigns (max 5) ---';
    RETURN QUERY
    SELECT FORMAT('  ID: %s | Name: %s | Active: %s', 
        LEFT(id::TEXT, 8), 
        COALESCE(name, 'NULL'),
        COALESCE(is_active::TEXT, 'NULL'))
    FROM marketing_campaigns
    LIMIT 5;
    RETURN QUERY SELECT '';
    
    -- FOOTER
    RETURN QUERY SELECT '========================================';
    RETURN QUERY SELECT 'FIN DE AUDITORÍA';
    RETURN QUERY SELECT '========================================';
END;
$$ LANGUAGE plpgsql;

-- EJECUTAR LA AUDITORÍA
SELECT * FROM temp_audit_database();

-- LIMPIAR
DROP FUNCTION IF EXISTS temp_audit_database();