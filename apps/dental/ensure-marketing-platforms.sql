-- Verificar si existen plataformas del sistema y crearlas si no existen

-- Crear plataformas del sistema si no existen
INSERT INTO categories (
  id,
  entity_type,
  name,
  display_name,
  is_system,
  is_active,
  clinic_id,
  display_order,
  created_at,
  updated_at
) VALUES 
  -- Meta Ads
  (gen_random_uuid(), 'marketing_platform', 'meta_ads', 'Meta Ads', true, true, NULL, 1, NOW(), NOW()),
  -- Google Ads
  (gen_random_uuid(), 'marketing_platform', 'google_ads', 'Google Ads', true, true, NULL, 2, NOW(), NOW()),
  -- TikTok Ads
  (gen_random_uuid(), 'marketing_platform', 'tiktok_ads', 'TikTok Ads', true, true, NULL, 3, NOW(), NOW()),
  -- Instagram Ads
  (gen_random_uuid(), 'marketing_platform', 'instagram_ads', 'Instagram Ads', true, true, NULL, 4, NOW(), NOW()),
  -- YouTube Ads
  (gen_random_uuid(), 'marketing_platform', 'youtube_ads', 'YouTube Ads', true, true, NULL, 5, NOW(), NOW()),
  -- LinkedIn Ads
  (gen_random_uuid(), 'marketing_platform', 'linkedin_ads', 'LinkedIn Ads', true, true, NULL, 6, NOW(), NOW()),
  -- Radio
  (gen_random_uuid(), 'marketing_platform', 'radio', 'Radio', true, true, NULL, 7, NOW(), NOW()),
  -- Televisión
  (gen_random_uuid(), 'marketing_platform', 'television', 'Televisión', true, true, NULL, 8, NOW(), NOW()),
  -- Prensa
  (gen_random_uuid(), 'marketing_platform', 'prensa', 'Prensa', true, true, NULL, 9, NOW(), NOW()),
  -- Volantes
  (gen_random_uuid(), 'marketing_platform', 'volantes', 'Volantes', true, true, NULL, 10, NOW(), NOW()),
  -- Referido Personal
  (gen_random_uuid(), 'marketing_platform', 'referido_personal', 'Referido Personal', true, true, NULL, 11, NOW(), NOW()),
  -- Redes Sociales Orgánico
  (gen_random_uuid(), 'marketing_platform', 'redes_sociales_organico', 'Redes Sociales Orgánico', true, true, NULL, 12, NOW(), NOW())
ON CONFLICT (name, entity_type) DO NOTHING;

