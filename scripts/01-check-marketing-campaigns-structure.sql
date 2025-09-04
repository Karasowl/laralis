-- VER EXACTAMENTE QUÉ COLUMNAS TIENE marketing_campaigns
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;