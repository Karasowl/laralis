-- Verificar si hay sesiones de chat
SELECT 
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as total_users
FROM ai_chat_sessions;

-- Ver las últimas 5 sesiones
SELECT 
  id,
  title,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM ai_chat_messages WHERE session_id = ai_chat_sessions.id) as message_count
FROM ai_chat_sessions
ORDER BY updated_at DESC
LIMIT 5;

-- Ver si hay mensajes huérfanos (sin sesión)
SELECT COUNT(*) as orphaned_messages
FROM ai_chat_messages
WHERE session_id NOT IN (SELECT id FROM ai_chat_sessions);
