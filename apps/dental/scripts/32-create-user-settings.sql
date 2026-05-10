-- =====================================================
-- SCRIPT: CREAR TABLA DE CONFIGURACIÓN DE USUARIO
-- =====================================================

-- 1. Crear la tabla user_settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (user_id, key)
);

-- 2. Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de seguridad (RLS)
-- Política: Los usuarios solo pueden ver sus propias configuraciones
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar/actualizar sus propias configuraciones
CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Política: Los usuarios pueden borrar sus propias configuraciones
CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 5. Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Tabla user_settings creada exitosamente con RLS habilitado.';
END $$;
