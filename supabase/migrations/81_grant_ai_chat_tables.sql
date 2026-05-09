-- Grants for Lara persisted chat tables.
-- The API uses service_role through PostgREST, which still needs explicit table
-- privileges when tables are created by migrations.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO authenticated, service_role;
