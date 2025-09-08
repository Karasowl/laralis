-- ============================================
-- SCRIPT PARA CREAR TABLA DE CÓDIGOS DE VERIFICACIÓN
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

-- Crear tabla para códigos de verificación
CREATE TABLE IF NOT EXISTS public.verification_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires 
ON public.verification_codes(expires_at);

-- Comentarios para documentación
COMMENT ON TABLE public.verification_codes IS 'Códigos de verificación temporales para acciones sensibles';
COMMENT ON COLUMN public.verification_codes.email IS 'Email del usuario que solicita el código';
COMMENT ON COLUMN public.verification_codes.code IS 'Código de verificación de 6 dígitos';
COMMENT ON COLUMN public.verification_codes.expires_at IS 'Fecha y hora de expiración del código';
COMMENT ON COLUMN public.verification_codes.used IS 'Indica si el código ya fue utilizado';

-- Función para limpiar códigos expirados (opcional, se puede ejecutar periódicamente)
CREATE OR REPLACE FUNCTION clean_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.verification_codes 
  WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- Política de seguridad (RLS)
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Solo el servicio admin puede acceder a esta tabla
CREATE POLICY "Service role only" ON public.verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Función para verificar y usar un código (opcional, para mayor seguridad)
CREATE OR REPLACE FUNCTION verify_and_use_code(
  p_email TEXT,
  p_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Verificar si existe un código válido
  SELECT EXISTS(
    SELECT 1 FROM public.verification_codes
    WHERE email = p_email
    AND code = p_code
    AND used = false
    AND expires_at > NOW()
  ) INTO v_valid;
  
  IF v_valid THEN
    -- Marcar como usado
    UPDATE public.verification_codes
    SET used = true
    WHERE email = p_email;
  END IF;
  
  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para la función
GRANT EXECUTE ON FUNCTION verify_and_use_code TO service_role;

-- Crear un trigger para limpiar códigos antiguos automáticamente (opcional)
CREATE OR REPLACE FUNCTION auto_clean_old_codes()
RETURNS trigger AS $$
BEGIN
  -- Cada vez que se inserta un nuevo código, limpiar los viejos
  DELETE FROM public.verification_codes 
  WHERE expires_at < NOW() - INTERVAL '1 day' OR used = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clean_old_codes_trigger
  AFTER INSERT ON public.verification_codes
  FOR EACH STATEMENT
  EXECUTE FUNCTION auto_clean_old_codes();