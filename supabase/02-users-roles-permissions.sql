-- ============================================
-- 02. SISTEMA DE USUARIOS, ROLES Y PERMISOS
-- ============================================
-- Ejecutar después del script 01
-- Orden: Segundo script

-- Tabla de usuarios del workspace
CREATE TABLE IF NOT EXISTS public.workspace_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id),
  CONSTRAINT valid_workspace_role CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

-- Tabla de usuarios de clínica
CREATE TABLE IF NOT EXISTS public.clinic_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  can_access_all_patients BOOLEAN DEFAULT false,
  assigned_chair VARCHAR(50), -- Sillón asignado
  schedule JSONB DEFAULT '{}', -- Horario de trabajo
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, user_id),
  CONSTRAINT valid_clinic_role CHECK (role IN ('admin', 'doctor', 'assistant', 'receptionist', 'viewer'))
);

-- Tabla de perfiles de usuario extendidos
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  phone VARCHAR(50),
  professional_id VARCHAR(100), -- Cédula profesional
  specialty VARCHAR(100),
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{"email": true, "push": false, "sms": false}',
  locale VARCHAR(5) DEFAULT 'es',
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  theme VARCHAR(20) DEFAULT 'light',
  onboarding_completed BOOLEAN DEFAULT false,
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de invitaciones pendientes
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT invitation_role_check CHECK (
    (clinic_id IS NULL AND role IN ('owner', 'admin', 'member', 'viewer')) OR
    (clinic_id IS NOT NULL AND role IN ('admin', 'doctor', 'assistant', 'receptionist', 'viewer'))
  )
);

-- Tabla de sesiones activas
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Crear índices
CREATE INDEX idx_workspace_users_workspace_id ON public.workspace_users(workspace_id);
CREATE INDEX idx_workspace_users_user_id ON public.workspace_users(user_id);
CREATE INDEX idx_workspace_users_role ON public.workspace_users(role);
CREATE INDEX idx_clinic_users_clinic_id ON public.clinic_users(clinic_id);
CREATE INDEX idx_clinic_users_user_id ON public.clinic_users(user_id);
CREATE INDEX idx_clinic_users_role ON public.clinic_users(role);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_expires_at ON public.invitations(expires_at);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_workspace_id ON public.user_sessions(workspace_id);

-- Triggers para updated_at
CREATE TRIGGER update_workspace_users_updated_at BEFORE UPDATE ON public.workspace_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_users_updated_at BEFORE UPDATE ON public.clinic_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS para workspace_users
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace members" ON public.workspace_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users wu
      WHERE wu.workspace_id = workspace_users.workspace_id
      AND wu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage workspace users" ON public.workspace_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users wu
      WHERE wu.workspace_id = workspace_users.workspace_id
      AND wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'admin')
    )
  );

-- RLS para clinic_users
ALTER TABLE public.clinic_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinic members" ON public.clinic_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clinic_users cu
      WHERE cu.clinic_id = clinic_users.clinic_id
      AND cu.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.workspace_users wu
      JOIN public.clinics c ON c.workspace_id = wu.workspace_id
      WHERE c.id = clinic_users.clinic_id
      AND wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can manage clinic users" ON public.clinic_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clinic_users cu
      WHERE cu.clinic_id = clinic_users.clinic_id
      AND cu.user_id = auth.uid()
      AND cu.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.workspace_users wu
      JOIN public.clinics c ON c.workspace_id = wu.workspace_id
      WHERE c.id = clinic_users.clinic_id
      AND wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'admin')
    )
  );

-- RLS para user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS para invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations" ON public.invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = invitations.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view their own invitations" ON public.invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- RLS para user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
  FOR ALL USING (user_id = auth.uid());

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil al registrarse
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comentarios
COMMENT ON TABLE public.workspace_users IS 'Relación usuarios-workspace con roles';
COMMENT ON TABLE public.clinic_users IS 'Relación usuarios-clínica con roles específicos';
COMMENT ON TABLE public.user_profiles IS 'Información extendida del perfil de usuario';
COMMENT ON TABLE public.invitations IS 'Invitaciones pendientes para unirse a workspaces/clínicas';
COMMENT ON TABLE public.user_sessions IS 'Sesiones activas para auditoría y seguridad';