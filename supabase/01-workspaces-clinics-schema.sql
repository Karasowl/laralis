-- ============================================
-- 01. ESQUEMA DE WORKSPACES Y CLINICS
-- ============================================
-- Ejecutar como superadmin en Supabase Dashboard
-- Orden: Este script primero

-- Crear tablas de workspaces (espacios de trabajo/marcas)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_status VARCHAR(50) DEFAULT 'trial',
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  max_clinics INTEGER DEFAULT 3,
  max_users INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Crear tablas de clínicas (ubicaciones físicas)
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(2) DEFAULT 'MX',
  phone VARCHAR(50),
  email VARCHAR(255),
  tax_id VARCHAR(50), -- RFC
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- Crear índices para performance
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX idx_clinics_workspace_id ON public.clinics(workspace_id);
CREATE INDEX idx_clinics_slug ON public.clinics(slug);
CREATE INDEX idx_clinics_is_active ON public.clinics(is_active);

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS para workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspaces they belong to" ON public.workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = workspaces.id
      AND workspace_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their workspaces" ON public.workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = workspaces.id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role = 'owner'
    )
  );

CREATE POLICY "Owners can delete their workspaces" ON public.workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = workspaces.id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role = 'owner'
    )
  );

-- RLS para clinics
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinics they have access to" ON public.clinics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clinic_users
      WHERE clinic_users.clinic_id = clinics.id
      AND clinic_users.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = clinics.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can create clinics" ON public.clinics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = clinics.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update clinics" ON public.clinics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = clinics.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete clinics" ON public.clinics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_users
      WHERE workspace_users.workspace_id = clinics.workspace_id
      AND workspace_users.user_id = auth.uid()
      AND workspace_users.role = 'owner'
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE public.workspaces IS 'Espacios de trabajo/marcas que agrupan múltiples clínicas';
COMMENT ON TABLE public.clinics IS 'Ubicaciones físicas/sucursales de una marca';
COMMENT ON COLUMN public.workspaces.subscription_status IS 'Estado de suscripción: trial, active, cancelled, expired';
COMMENT ON COLUMN public.clinics.tax_id IS 'RFC o identificador fiscal de la clínica';