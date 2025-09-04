# Instrucciones para Debug de Creación de Campañas

## Problema
Hay un error 500 al crear campañas desde el modal en el formulario de pacientes.

## Pasos para Diagnosticar

### 1. Iniciar el servidor de desarrollo
```bash
cd web
npm run dev
```

### 2. Ejecutar el script de prueba básico
En otra terminal:
```bash
cd scripts
node test-debug-campaign.js
```

Este script:
- Primero obtiene las plataformas disponibles
- Luego intenta crear una campaña con una plataforma válida
- Muestra logs detallados del proceso

### 3. Revisar los logs del servidor
En la terminal donde está corriendo `npm run dev`, verás logs detallados como:
- `[POST /api/marketing/campaigns] Starting...`
- `[POST /api/marketing/campaigns] Request body: {...}`
- `[POST /api/marketing/campaigns] Clinic ID: ...`
- Etc.

### 4. Posibles causas del error 500

#### A. No hay plataformas en la base de datos
Si el script muestra "No hay plataformas disponibles", necesitas ejecutar esta migración en Supabase:

```sql
-- Insertar plataformas de marketing si no existen
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order, clinic_id) VALUES
    ('marketing_platform', 'meta_ads', 'Meta Ads', true, 1, NULL),
    ('marketing_platform', 'google_ads', 'Google Ads', true, 2, NULL),
    ('marketing_platform', 'tiktok_ads', 'TikTok Ads', true, 3, NULL),
    ('marketing_platform', 'other', 'Otro', true, 99, NULL)
ON CONFLICT (clinic_id, entity_type, name) DO NOTHING;
```

#### B. No existe la tabla marketing_campaigns
Si el error menciona que la tabla no existe, ejecuta:

```sql
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL,
    platform_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic ON public.marketing_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON public.marketing_campaigns(platform_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON public.marketing_campaigns(is_active);
```

#### C. No hay clínicas en la base de datos
Si el error dice "No clinic context available", necesitas crear al menos una clínica:

```sql
-- Verificar si hay clínicas
SELECT * FROM clinics;

-- Si no hay, crear una de prueba
INSERT INTO clinics (name, description) 
VALUES ('Clínica de Prueba', 'Clínica para desarrollo');
```

### 5. Verificar desde la UI
1. Abre http://localhost:3000/patients
2. Haz clic en "Nuevo Paciente"
3. En el campo de Campaña, intenta crear una nueva
4. Revisa la consola del navegador (F12) y los logs del servidor

### 6. Si el problema persiste
Comparte:
1. Los logs del servidor cuando intentas crear una campaña
2. El resultado del script `test-debug-campaign.js`
3. El error exacto que aparece en la consola del navegador

## Solución Implementada

Se mejoró el route handler `/api/marketing/campaigns` con:
1. Logging detallado en cada paso
2. Verificación de que el platform_id existe antes de insertar
3. Mensajes de error más descriptivos
4. Manejo robusto de errores

## Archivos Modificados
- `/web/app/api/marketing/campaigns/route.ts` - Mejorado con logging y validación
- `/web/app/api/debug-campaign/route.ts` - Endpoint de debug (temporal)
- `/scripts/test-debug-campaign.js` - Script de prueba