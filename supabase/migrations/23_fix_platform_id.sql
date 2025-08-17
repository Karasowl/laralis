-- Fix: Agregar columna platform_id a marketing_campaigns existente

-- 1. Verificar si la tabla marketing_campaigns existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns') THEN
        RAISE NOTICE 'Table marketing_campaigns exists';
        
        -- Verificar si la columna platform_id ya existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'marketing_campaigns' 
            AND column_name = 'platform_id'
        ) THEN
            RAISE NOTICE 'Adding platform_id column';
            ALTER TABLE public.marketing_campaigns 
            ADD COLUMN platform_id UUID;
        ELSE
            RAISE NOTICE 'Column platform_id already exists';
        END IF;
        
    ELSE
        RAISE NOTICE 'Table marketing_campaigns does not exist, creating it';
        
        -- Crear la tabla completa
        CREATE TABLE public.marketing_campaigns (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            clinic_id UUID NOT NULL,
            platform_id UUID NOT NULL,
            
            -- Información de la campaña
            name VARCHAR(255) NOT NULL,
            code VARCHAR(100),
            description TEXT,
            
            -- Estado
            is_active BOOLEAN DEFAULT true,
            is_archived BOOLEAN DEFAULT false,
            archived_at TIMESTAMPTZ,
            reactivated_at TIMESTAMPTZ,
            
            -- Fechas de campaña
            start_date DATE,
            end_date DATE,
            
            -- Metadata
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Deshabilitar RLS
        ALTER TABLE public.marketing_campaigns DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic ON public.marketing_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON public.marketing_campaigns(platform_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON public.marketing_campaigns(is_active);

-- 3. Verificar/crear categorías de marketing platform
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, 1),
    ('marketing_platform', 'google_ads', 'Google Ads', true, 2),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, 3),
    ('marketing_platform', 'other', 'Otro', true, 99)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;

-- 4. Mostrar el estado final
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- Success
SELECT 'Platform_id column fixed successfully' as status;
