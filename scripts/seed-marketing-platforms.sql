-- Script para crear las plataformas de marketing predeterminadas
-- Ejecutar en Supabase SQL Editor

-- Primero verificamos si ya existen plataformas de marketing
SELECT COUNT(*) as count FROM categories WHERE entity_type = 'marketing_platform';

-- Insertar plataformas de marketing del sistema (disponibles para todas las clínicas)
INSERT INTO categories (entity_type, name, display_name, is_system, is_active, display_order) 
VALUES 
  ('marketing_platform', 'facebook', 'Facebook', true, true, 1),
  ('marketing_platform', 'instagram', 'Instagram', true, true, 2),
  ('marketing_platform', 'google', 'Google', true, true, 3),
  ('marketing_platform', 'tiktok', 'TikTok', true, true, 4),
  ('marketing_platform', 'youtube', 'YouTube', true, true, 5),
  ('marketing_platform', 'whatsapp', 'WhatsApp', true, true, 6),
  ('marketing_platform', 'website', 'Sitio Web', true, true, 7),
  ('marketing_platform', 'referral', 'Referencia', true, true, 8),
  ('marketing_platform', 'walk_in', 'Visita Directa', true, true, 9),
  ('marketing_platform', 'phone', 'Llamada Telefónica', true, true, 10),
  ('marketing_platform', 'email', 'Email', true, true, 11),
  ('marketing_platform', 'sms', 'SMS', true, true, 12),
  ('marketing_platform', 'other', 'Otro', true, true, 99)
ON CONFLICT DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT * FROM categories 
WHERE entity_type = 'marketing_platform' 
ORDER BY display_order, display_name;