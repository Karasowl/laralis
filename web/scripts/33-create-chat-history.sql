-- =====================================================
-- SCRIPT: CREAR TABLAS PARA HISTORIAL DE CHAT IA
-- =====================================================

-- 1. Crear tabla de sesiones de chat
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Crear tabla de mensajes de chat
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Para guardar thinking, data, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Habilitar RLS
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para Sesiones
CREATE POLICY "Users can view their own sessions" ON ai_chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON ai_chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON ai_chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON ai_chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Políticas RLS para Mensajes
-- Los mensajes son accesibles si el usuario tiene acceso a la sesión
CREATE POLICY "Users can view messages of their sessions" ON ai_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ai_chat_sessions s
            WHERE s.id = session_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to their sessions" ON ai_chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_chat_sessions s
            WHERE s.id = session_id
            AND s.user_id = auth.uid()
        )
    );

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);

-- 7. Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Tablas de historial de chat creadas exitosamente.';
END $$;
