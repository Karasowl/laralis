# Sistema de Exportación e Importación - Laralis

## 📋 Descripción General

Sistema completo de exportación e importación de datos de workspace con:
- **Versionado de esquema**: Migraciones automáticas para compatibilidad hacia adelante
- **Validación de integridad**: Checksums SHA-256 y validación de estructura
- **Importación transaccional**: Rollback manual en caso de errores
- **25 tablas exportadas**: Cobertura completa de datos del usuario

## 🏗️ Arquitectura

### Componentes Principales

```
web/lib/export/
├── types.ts           # Interfaces TypeScript para todas las tablas
├── checksum.ts        # Generación y verificación SHA-256
├── migrations.ts      # Catálogo de migraciones de esquema
├── migrator.ts        # Motor de migraciones automáticas
├── exporter.ts        # Exportación de workspace completo
├── validator.ts       # 8 tipos de validaciones
├── importer.ts        # Importación con rollback manual
└── index.ts           # Barrel export
```

### Flujo de Datos

```
EXPORTACIÓN:
User → UI → API → Exporter → Query DB → Bundle → Checksum → JSON Download

IMPORTACIÓN:
User → Upload → Validator → Migrator → Importer → Insert DB → Success/Rollback
```

## 📦 Formato del Bundle

### Estructura JSON

```json
{
  "metadata": {
    "version": "1.0.0",
    "schemaVersion": 41,
    "exportedAt": "2025-10-22T...",
    "exportedBy": "user-uuid",
    "checksum": "sha256-hash"
  },
  "data": {
    "workspace": { ... },
    "organizations": [...],
    "categoryTypes": [...],
    "rolePermissions": [...],
    "workspaceUsers": [...],
    "workspaceMembers": [...],
    "clinics": [
      {
        "clinic": { ... },
        "clinicUsers": [...],
        "invitations": [...],
        "customCategories": [...],
        "settingsTime": [...],
        "patientSources": [...],
        "assets": [...],
        "supplies": [...],
        "fixedCosts": [...],
        "services": [...],
        "serviceSupplies": [...],
        "tariffs": [...],
        "marketingCampaigns": [...],
        "marketingCampaignStatusHistory": [...],
        "patients": [...],
        "treatments": [...],
        "expenses": [...]
      }
    ]
  },
  "migrations": {
    "from": 41,
    "to": 41,
    "applied": []
  }
}
```

## 🔄 Sistema de Migraciones

### Versionado de Esquema

- **CURRENT_SCHEMA_VERSION**: 41 (sincronizado con última migración Supabase)
- **EXPORT_FORMAT_VERSION**: 1.0.0

### Compatibilidad hacia Adelante

Cuando el esquema cambie en el futuro (ej. v42), se añade una migración:

```typescript
{
  from: 41,
  to: 42,
  description: 'Add new marketing_platforms table',
  transform: (bundle: ExportBundle) => {
    // Transformar bundle antiguo a nuevo formato
    bundle.data.clinics.forEach(clinic => {
      clinic.marketingPlatforms = []; // Añadir nuevo campo
    });
    return bundle;
  },
  validate: (bundle: ExportBundle) => {
    // Validar que la migración fue correcta
    return [];
  }
}
```

El sistema aplica migraciones secuencialmente: v41 → v42 → v43 → ... → current

## ✅ Sistema de Validación

### 8 Tipos de Validación

1. **Estructura**: Verifica campos requeridos en metadata y data
2. **Checksum**: Valida integridad con SHA-256
3. **Versión de Esquema**: Verifica que sea migrable al esquema actual
4. **Campos de Dinero**: Asegura que sean integers (no floats)
5. **Tipos de Datos**: Valida tipos TypeScript
6. **Claves Foráneas**: Verifica que todas las FKs existan
7. **Restricciones Únicas**: Valida unicidad donde aplique
8. **Campos Requeridos**: Verifica campos NOT NULL

### Resultado de Validación

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];      // Bloquean importación
  warnings: ValidationWarning[];  // No bloquean
  stats: {
    totalClinics: number;
    totalPatients: number;
    totalTreatments: number;
    // ... más estadísticas
  };
}
```

## 📥 Proceso de Importación

### Orden de Inserción (Respetando FKs)

**Nivel 1**: workspace
**Nivel 2**: organizations, workspaceUsers, workspaceMembers
**Nivel 3**: categoryTypes, rolePermissions
**Nivel 4**: clinics
**Nivel 5**: clinicUsers, invitations, customCategories, settingsTime, patientSources
**Nivel 6**: assets, supplies, fixedCosts
**Nivel 7**: services
**Nivel 8**: serviceSupplies, tariffs, marketingCampaigns
**Nivel 9**: marketingCampaignStatusHistory, patients
**Nivel 10**: treatments, expenses

### Mapeo de IDs

Durante la importación, se mapean IDs antiguos a nuevos:

```typescript
idMappings = {
  workspace: { 'old-id': 'new-id' },
  clinics: { 'old-clinic-id': 'new-clinic-id' },
  patients: { 'old-patient-id': 'new-patient-id' },
  // ... para todas las tablas
}
```

Esto permite resolver FKs correctamente.

### Rollback Manual

Si algo falla durante la importación:

1. Se captura el error
2. Se detiene la inserción
3. Se eliminan todos los registros insertados (usando idMappings)
4. Se retorna error al usuario

**Nota**: Supabase no tiene transacciones nativas, por eso el rollback es manual.

## 🔐 Seguridad y Permisos

### Permisos Requeridos

- **Exportar**: `workspace.owner` o `super_admin`
- **Importar**: `workspace.owner` o `super_admin`

### Validación de Permisos

```typescript
// En API endpoints
const canExport = await canExportWorkspace(supabase, user.id, workspaceId);
if (!canExport) {
  return NextResponse.json(
    { error: 'Insufficient permissions' },
    { status: 403 }
  );
}
```

### RLS (Row Level Security)

Todas las consultas respetan las políticas RLS de Supabase. El sistema NO usa el service role key para bypass.

## 📊 Tablas Exportadas (25)

### Workspace Level (7 tablas)
- workspaces
- organizations
- workspace_users
- workspace_members
- category_types
- role_permissions
- clinics

### Clinic Level (18 tablas)
- clinic_users
- invitations
- custom_categories
- settings_time
- patient_sources
- assets
- supplies
- fixed_costs
- services
- service_supplies
- tariffs
- marketing_campaigns
- marketing_campaign_status_history
- patients
- treatments
- expenses
- workspace_activity (opcional)

## 🚀 Uso

### Exportar Datos

**UI**: `/settings/export-import` → Tab "Export"

**API**:
```typescript
POST /api/export/generate
Body: {
  workspaceId: string,
  options: {
    includeAuditLogs: boolean,
    includeHistorical: boolean
  }
}
Response: JSON file download
```

**Programático**:
```typescript
import { WorkspaceExporter } from '@/lib/export';

const exporter = new WorkspaceExporter(supabase, workspaceId, options);
const { bundle, stats } = await exporter.export();
```

### Validar Bundle

**UI**: Automático al seleccionar archivo en tab "Import"

**API**:
```typescript
POST /api/export/validate
Body: { bundle: ExportBundle }
Response: { valid, errors, warnings, stats, migrationPreview }
```

**Programático**:
```typescript
import { BundleValidator } from '@/lib/export';

const validator = new BundleValidator(bundle, supabase);
const result = await validator.validate();
```

### Importar Datos

**UI**: `/settings/export-import` → Tab "Import" → Confirmar después de validación

**API**:
```typescript
POST /api/export/import
Body: {
  bundle: ExportBundle,
  options: {
    overwriteExisting: boolean,
    skipInvalid: boolean
  }
}
Response: {
  success: boolean,
  stats: ImportStats,
  errors?: string[]
}
```

**Programático**:
```typescript
import { WorkspaceBundleImporter } from '@/lib/export';

const importer = new WorkspaceBundleImporter(
  bundle,
  supabase,
  userId,
  options,
  (progress) => console.log(progress)
);
const result = await importer.import();
```

## 🧪 Testing

### Unit Tests

```bash
npm test lib/export/checksum.test.ts
npm test lib/export/migrations.test.ts
npm test lib/export/validator.test.ts
```

### E2E Test Flow

1. Crear workspace con datos de prueba
2. Exportar bundle
3. Validar checksum
4. Eliminar workspace
5. Importar bundle
6. Verificar que todos los datos coincidan

## ⚠️ Limitaciones Conocidas

1. **Transacciones**: Rollback manual, no atómico
2. **Tamaño**: Bundles muy grandes (>100MB) pueden tardar
3. **Timeout**: API tiene límite de 5 minutos para importación
4. **Validación FK**: Solo valida existencia, no integridad referencial completa
5. **Migraciones complejas**: Transformaciones simples, no soporta reestructuraciones complejas

## 📈 Mejoras Futuras

- [ ] Streaming de bundles grandes
- [ ] Importación parcial por clínica
- [ ] Compresión GZIP de bundles
- [ ] Tests E2E automatizados
- [ ] UI de preview antes de importar
- [ ] Exportación programada/automática
- [ ] Soporte para migraciones complejas con SQL
- [ ] Métricas de performance

## 📚 Referencias

- **Migrations**: `supabase/migrations/` (esquema actual)
- **Schema Docs**: `docs/database/SCHEMA-CURRENT.md`
- **Coding Standards**: `docs/CODING-STANDARDS.md`
- **Devlog**: `docs/devlog/2025-10-22-export-import-system.md`

## 🤝 Contribuir

Al modificar el sistema de exportación:

1. **Actualizar versión de esquema** en `migrations.ts` si hay cambios estructurales
2. **Añadir migración** al catálogo `EXPORT_MIGRATIONS`
3. **Actualizar tipos** en `types.ts`
4. **Añadir tests** para nuevas migraciones
5. **Documentar** en este archivo

---

**Última actualización**: 2025-10-22
**Versión del sistema**: 1.0.0
**Schema version**: 41
