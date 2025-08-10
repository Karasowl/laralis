-- Migration: Arreglar estructuras de workspaces y crear tabla de servicios dentales

-- 1. Primero verificar y limpiar la estructura de workspaces
-- Verificar si la columna role ya existe en alguna tabla relacionada
DO $$
BEGIN
    -- Si workspace_members ya existe con columna role, no hacer nada
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'workspace_members' 
        AND column_name = 'role'
    ) THEN
        RAISE NOTICE 'La tabla workspace_members ya tiene columna role';
    ELSE
        -- Si no existe, intentar crearla de manera segura
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
            CREATE TABLE public.workspace_members (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                workspace_id UUID NOT NULL,
                user_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                display_name VARCHAR(255),
                role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'super_admin', 'admin', 'editor', 'viewer')),
                permissions JSONB DEFAULT '{}',
                allowed_clinics UUID[] DEFAULT NULL,
                invitation_status VARCHAR(50) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
                invited_at TIMESTAMPTZ DEFAULT NOW(),
                accepted_at TIMESTAMPTZ,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(workspace_id, user_id),
                UNIQUE(workspace_id, email)
            );
            
            -- Añadir FK solo si workspaces existe
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
                ALTER TABLE public.workspace_members 
                ADD CONSTRAINT fk_workspace_members_workspace 
                FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
            END IF;
        END IF;
    END IF;
END $$;

-- 2. Renombrar la tabla services actual si es incorrecta y crear la correcta
DO $$
BEGIN
    -- Verificar si la tabla services tiene columnas incorrectas
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name IN ('typsubscript', 'web_authn_aaguid', 'relpersistence')
    ) THEN
        -- Esta es una tabla del sistema incorrecta, renombrarla
        EXECUTE 'ALTER TABLE IF EXISTS public.services RENAME TO services_system_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
        RAISE NOTICE 'Tabla services del sistema renombrada a backup';
    END IF;
END $$;

-- 3. Crear la tabla correcta de servicios dentales
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Información básica del servicio
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    
    -- Tiempo estimado
    est_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Costos
    fixed_cost_per_minute_cents INTEGER DEFAULT 0, -- Costo fijo por minuto
    variable_cost_cents INTEGER DEFAULT 0, -- Costo variable total de insumos
    
    -- Margen y precio
    margin_pct NUMERIC(5,2) DEFAULT 30.00, -- Margen de ganancia en porcentaje
    price_cents INTEGER NOT NULL, -- Precio final al cliente
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint único por clínica y nombre
    UNIQUE(clinic_id, name)
);

-- 4. Crear tabla de recetas (relación servicios-insumos) si no existe
CREATE TABLE IF NOT EXISTS public.service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    
    -- Cantidad de porciones del insumo que usa este servicio
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    
    -- Costo unitario en el momento de asociación (snapshot)
    unit_cost_cents INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un insumo solo puede estar una vez por servicio
    UNIQUE(service_id, supply_id)
);

-- 5. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_services_clinic ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_supplies_service ON public.service_supplies(service_id);
CREATE INDEX IF NOT EXISTS idx_service_supplies_supply ON public.service_supplies(supply_id);

-- 6. Trigger para mantener updated_at en services
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_services_updated_at 
BEFORE UPDATE ON public.services 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_supplies_updated_at 
BEFORE UPDATE ON public.service_supplies 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 7. Verificar que las tablas de categorías existan
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'supply' o 'service'
    code VARCHAR(50) NOT NULL,
    name_es VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, type, code)
);

-- 8. Insertar categorías del sistema si no existen
INSERT INTO public.categories (clinic_id, type, code, name_es, name_en, is_system) VALUES
    -- Categorías de insumos
    (NULL, 'supply', 'anesthesia', 'Anestesia', 'Anesthesia', true),
    (NULL, 'supply', 'disposables', 'Desechables', 'Disposables', true),
    (NULL, 'supply', 'materials', 'Materiales', 'Materials', true),
    (NULL, 'supply', 'instruments', 'Instrumental', 'Instruments', true),
    (NULL, 'supply', 'medication', 'Medicación', 'Medication', true),
    (NULL, 'supply', 'cleaning', 'Limpieza', 'Cleaning', true),
    (NULL, 'supply', 'office', 'Oficina', 'Office', true),
    (NULL, 'supply', 'lab', 'Laboratorio', 'Laboratory', true),
    
    -- Categorías de servicios
    (NULL, 'service', 'preventive', 'Preventivo', 'Preventive', true),
    (NULL, 'service', 'diagnostic', 'Diagnóstico', 'Diagnostic', true),
    (NULL, 'service', 'restorative', 'Restaurativo', 'Restorative', true),
    (NULL, 'service', 'endodontics', 'Endodoncia', 'Endodontics', true),
    (NULL, 'service', 'periodontics', 'Periodoncia', 'Periodontics', true),
    (NULL, 'service', 'surgery', 'Cirugía', 'Surgery', true),
    (NULL, 'service', 'orthodontics', 'Ortodoncia', 'Orthodontics', true),
    (NULL, 'service', 'prosthetics', 'Prótesis', 'Prosthetics', true),
    (NULL, 'service', 'cosmetic', 'Estética', 'Cosmetic', true),
    (NULL, 'service', 'emergency', 'Emergencia', 'Emergency', true)
ON CONFLICT (clinic_id, type, code) DO NOTHING;

-- Success
SELECT 'Migración completada: Estructuras corregidas y tabla de servicios dentales creada' as status;