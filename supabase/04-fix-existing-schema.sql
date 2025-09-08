-- ============================================
-- 04. ACTUALIZAR ESQUEMA EXISTENTE
-- ============================================
-- Este script actualiza el esquema existente sin duplicar
-- Ejecutar después de verificar qué ya existe

-- Agregar columnas faltantes a workspaces si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'workspaces' AND column_name = 'subscription_status') THEN
    ALTER TABLE public.workspaces ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trial';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'workspaces' AND column_name = 'subscription_ends_at') THEN
    ALTER TABLE public.workspaces ADD COLUMN subscription_ends_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'workspaces' AND column_name = 'max_clinics') THEN
    ALTER TABLE public.workspaces ADD COLUMN max_clinics INTEGER DEFAULT 3;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'workspaces' AND column_name = 'max_users') THEN
    ALTER TABLE public.workspaces ADD COLUMN max_users INTEGER DEFAULT 10;
  END IF;
END $$;

-- Crear workspace_users si no existe
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

-- Crear clinic_users si no existe
CREATE TABLE IF NOT EXISTS public.clinic_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  can_access_all_patients BOOLEAN DEFAULT false,
  assigned_chair VARCHAR(50),
  schedule JSONB DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, user_id),
  CONSTRAINT valid_clinic_role CHECK (role IN ('admin', 'doctor', 'assistant', 'receptionist', 'viewer'))
);

-- Crear invitations si no existe
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

-- Crear índices solo si no existen
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON public.workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON public.workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_role ON public.workspace_users(role);
CREATE INDEX IF NOT EXISTS idx_clinic_users_clinic_id ON public.clinic_users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_users_user_id ON public.clinic_users(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- Habilitar RLS si no está habilitado
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (drop primero por si existen)
DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_users;
CREATE POLICY "Users can view workspace members" ON public.workspace_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users wu
      WHERE wu.workspace_id = workspace_users.workspace_id
      AND wu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage workspace users" ON public.workspace_users;
CREATE POLICY "Admins can manage workspace users" ON public.workspace_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users wu
      WHERE wu.workspace_id = workspace_users.workspace_id
      AND wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view clinic members" ON public.clinic_users;
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

DROP POLICY IF EXISTS "Admins can manage clinic users" ON public.clinic_users;
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

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
CREATE POLICY "Admins can manage invitations" ON public.invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = invitations.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view their own invitations" ON public.invitations;
CREATE POLICY "Users can view their own invitations" ON public.invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );