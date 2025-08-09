# Devlog: Base Multi-Tenant - Organizaciones y Clínicas

**PR**: #pending
**Task**: TASK-20250809-multi-tenant-base
**Fecha**: 2025-08-09

## Contexto

La aplicación necesitaba soportar múltiples negocios y clínicas. Hasta ahora, guardaba "Horario y capacidad" y "Costos fijos" de forma global sin distinguir entre diferentes ubicaciones o negocios.

## Problema

No existía separación de datos entre clínicas. Un usuario no podía gestionar múltiples ubicaciones con diferentes configuraciones, costos y datos.

## Causa raíz

El diseño inicial asumía una sola clínica, sin modelo multi-tenant. Las tablas `settings_time` y `fixed_costs` no tenían campo para distinguir entre clínicas.

## Qué cambió

### 1. Esquema de Base de Datos
- Nuevas tablas:
  - `organizations`: Empresas/grupos dentales
  - `clinics`: Clínicas individuales pertenecientes a organizaciones
- Modificaciones:
  - `settings_time` y `fixed_costs` ahora incluyen `clinic_id`
- Migración con backfill automático para datos existentes

### 2. Modelo de Datos TypeScript
- Nuevos tipos: `Organization`, `Clinic`
- Tipos actualizados con `clinic_id`: `SettingsTime`, `FixedCost`
- Esquemas Zod actualizados para validación

### 3. Gestión de Contexto de Clínica
- Cookie `clinicId` para persistir selección
- Helpers en `lib/clinic.ts` para manejo de cookies
- Fallback automático a primera clínica si no hay selección

### 4. APIs Multi-Tenant
- `/api/clinics`: GET lista de clínicas, POST para seleccionar
- APIs existentes filtran por `clinic_id` desde cookie o query param
- Validación que solo se acceda a datos de la clínica activa

### 5. UI Business Switcher
- Componente selector de clínica en header
- Refresh automático al cambiar de clínica
- Integrado junto al Language Switcher

## Archivos tocados

```
CREATED:
- supabase/migrations/02_multi_tenant.sql
- web/lib/clinic.ts
- web/app/api/clinics/route.ts
- web/components/BusinessSwitcher.tsx

MODIFIED:
- supabase/seed.sql
- web/lib/types.ts
- web/lib/zod.ts
- web/app/api/settings/time/route.ts
- web/app/api/fixed-costs/route.ts
- web/app/api/fixed-costs/[id]/route.ts
- web/app/layout.tsx
- web/messages/en.json
- web/messages/es.json
```

## Antes vs Después

### Antes
- Una configuración global para toda la app
- Sin distinción entre ubicaciones
- Datos mezclados si hubiera múltiples clínicas

### Después
- Cada clínica tiene sus propios datos
- Selector en header para cambiar entre clínicas
- APIs filtradas por contexto de clínica
- Cookie persiste la selección del usuario

## Cómo probar

1. **Ejecutar migraciones en Supabase**:
   ```sql
   -- Ejecutar contenido de supabase/migrations/02_multi_tenant.sql
   -- Ejecutar contenido de supabase/seed.sql actualizado
   ```

2. **Verificar el Business Switcher**:
   - En el header debe aparecer un selector con "Toluca Centro" y "Toluca Norte"
   - Al cambiar de clínica, la página se refresca

3. **Verificar filtrado de datos**:
   - Navegar a "Configuración > Tiempo"
   - Cambiar de clínica y ver que muestra datos diferentes
   - Lo mismo con "Costos Fijos"

4. **Verificar APIs**:
   ```bash
   # Lista de clínicas
   curl http://localhost:3000/api/clinics
   
   # Settings por clínica (usa cookie o query param)
   curl http://localhost:3000/api/settings/time?clinicId=<uuid>
   ```

## Riesgos y rollback

### Riesgos
- Si las cookies están deshabilitadas, siempre usará la primera clínica
- La migración modifica tablas existentes (agrega columnas)

### Rollback
Si necesitas revertir:
1. Revertir los cambios de código
2. En Supabase, ejecutar:
   ```sql
   -- Quitar columnas (CUIDADO: se pierden datos)
   ALTER TABLE settings_time DROP COLUMN clinic_id;
   ALTER TABLE fixed_costs DROP COLUMN clinic_id;
   DROP TABLE clinics;
   DROP TABLE organizations;
   ```

## Siguientes pasos

- **TASK-20250810-auth-rls**: Implementar autenticación y RLS para multi-tenant
- **TASK-20250810-user-clinic-membership**: Sistema de membresías usuario-clínica
- **TASK-20250810-clinic-admin-panel**: Panel de administración de clínicas

## Notas técnicas

- RLS está deshabilitado temporalmente (se activará con auth)
- La cookie `clinicId` es httpOnly para seguridad
- El backfill asigna todos los datos existentes a "Toluca Centro"
- Los índices en `clinic_id` mejoran performance de queries filtradas