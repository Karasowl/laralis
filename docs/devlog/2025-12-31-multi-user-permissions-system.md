# Sistema de Roles y Permisos Multi-Usuario

**Fecha**: 2025-12-31
**TASK-ID**: TASK-20251231-permissions
**PR**: Pending

---

## Contexto

La aplicación necesitaba soportar múltiples usuarios accediendo a las mismas clínicas con diferentes niveles de permisos. El sistema anterior solo soportaba un usuario por workspace.

## Problema

- Un solo usuario por clínica limitaba el uso en consultorios con múltiples profesionales
- No había manera de invitar colaboradores con permisos específicos
- Las políticas RLS referenciaban `clinic_memberships` (tabla inexistente)

## Solución Implementada

### Arquitectura de Permisos

```
Workspace (propietario)
├── workspace_users (miembros con rol a nivel workspace)
│   ├── owner (todo)
│   ├── super_admin (casi todo)
│   ├── admin (operaciones, sin finanzas)
│   ├── editor (crear/editar, sin borrar)
│   └── viewer (solo lectura)
│
└── Clinic (puede haber múltiples)
    └── clinic_users (rol específico en esa clínica)
        ├── admin
        ├── doctor
        ├── assistant
        ├── receptionist
        └── viewer
```

### Flujo de Resolución de Permisos

```
1. ¿Es owner del workspace? → SÍ → Permitir todo
2. ¿Es super_admin? → SÍ → Permitir casi todo
3. ¿Tiene override en custom_permissions? → Usar override
4. ¿Tiene rol en clinic_users? → Usar permisos del rol clínica
5. Fallback → Usar permisos del rol workspace
```

### Flujo de Invitación

```
1. ADMIN → Abre modal "Invitar miembro"
   ├─ Ingresa email
   ├─ Selecciona rol (workspace o clinic)
   └─ (Opcional) Agrega mensaje personal

2. SISTEMA → Crea invitation con token (64 chars, expira 7 días)

3. USUARIO → Recibe link /invite/[token]
   ├─ SI tiene cuenta → Login → Aceptar
   └─ SI NO tiene cuenta → Signup → Aceptar

4. ACEPTAR → Crea workspace_users y/o clinic_users
   └─ Redirige a dashboard
```

---

## Archivos Creados/Modificados

### Migraciones SQL (EJECUTAR EN SUPABASE)

| Archivo | Descripción |
|---------|-------------|
| `70_granular_permissions_system.sql` | Sistema de permisos, custom_role_templates, funciones RPC |
| `71_seed_role_permissions.sql` | Permisos base por rol (~300 registros) |
| `72_fix_rls_clinic_memberships.sql` | Corrige RLS policies, crea funciones helper |

### APIs Creadas

| Ruta | Métodos | Descripción |
|------|---------|-------------|
| `/api/permissions/my` | GET | Permisos del usuario actual |
| `/api/permissions/check` | GET | Verificar permiso específico |
| `/api/team/workspace-members` | GET, POST | Listar/invitar miembros workspace |
| `/api/team/workspace-members/[id]` | PUT, DELETE | Editar/remover miembro |
| `/api/team/clinic-members` | GET, POST | Listar/agregar miembros clínica |
| `/api/team/clinic-members/[id]` | PUT, DELETE | Editar/remover miembro clínica |
| `/api/invitations` | GET, POST, DELETE | CRUD invitaciones |
| `/api/invitations/[id]/resend` | POST | Reenviar invitación |
| `/api/invitations/accept/[token]` | GET, POST | Info y aceptar invitación |
| `/api/invitations/reject/[token]` | POST | Rechazar invitación |

### Hooks Creados

| Hook | Uso |
|------|-----|
| `usePermissions()` | `{ can, canAll, canAny, cannot, isSuperUser, isAdmin }` |
| `useCanDo(permission)` | Boolean shorthand para un permiso |
| `usePermissionCheck()` | Verificación vía API |
| `useWorkspaceMembers()` | CRUD miembros workspace |
| `useClinicMembers(clinicId)` | CRUD miembros clínica |
| `useInvitations()` | Gestión de invitaciones |
| `useInvitation(token)` | Para página de aceptar invitación |

### Componentes Auth

| Componente | Uso |
|------------|-----|
| `<Can permission="..." mode="all\|any">` | Renderizar si tiene permiso |
| `<CanNot permission="...">` | Renderizar si NO tiene permiso |
| `<PermissionGate>` | Gate avanzado con fallback |
| `withPermission()` | HOC para proteger componentes |

### UI de Team Settings

```
web/app/settings/team/
├── page.tsx                    # Server component
├── TeamPageClient.tsx          # Client con 3 tabs
└── components/
    ├── WorkspaceMembersTab.tsx # Lista miembros workspace
    ├── ClinicMembersTab.tsx    # Lista miembros clínica
    ├── InvitationsTab.tsx      # Invitaciones pendientes
    ├── InviteMemberModal.tsx   # Modal para invitar
    ├── EditMemberModal.tsx     # Modal para editar rol
    └── index.ts
```

### Página de Invitación

```
web/app/invite/[token]/
├── page.tsx              # Server component
└── InvitePageClient.tsx  # Maneja auth, accept/reject
```

### i18n

~150 nuevas keys en `en.json` y `es.json`:
- `team.*` - Team settings UI
- `invite.*` - Invitation page
- `permissions.*` - Permission labels

---

## Cómo Probar

### 1. Ejecutar migraciones en Supabase

Ir a SQL Editor y ejecutar en orden:
1. `70_granular_permissions_system.sql`
2. `71_seed_role_permissions.sql`
3. `72_fix_rls_clinic_memberships.sql`

### 2. Acceder a Team Settings

1. Ir a Settings → Team (ruta: `/settings/team`)
2. Ver los 3 tabs: Workspace, Clínicas, Invitaciones

### 3. Invitar un miembro

1. Click "Invitar miembro"
2. Ingresar email, seleccionar rol
3. Copiar el link de invitación generado
4. Abrir en ventana incógnito
5. Registrarse/Login con ese email
6. Aceptar invitación

### 4. Probar permisos

```typescript
// En cualquier componente
const { can, isSuperUser } = usePermissions();

if (can('patients.delete')) {
  // Mostrar botón de borrar
}
```

---

## Matriz de Permisos por Rol

### Workspace Roles

| Recurso | owner | super_admin | admin | editor | viewer |
|---------|:-----:|:-----------:|:-----:|:------:|:------:|
| patients.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| patients.create | ✅ | ✅ | ✅ | ✅ | ❌ |
| patients.delete | ✅ | ✅ | ✅ | ❌ | ❌ |
| treatments.mark_paid | ✅ | ✅ | ✅ | ❌ | ❌ |
| expenses.view | ✅ | ✅ | ❌ | ❌ | ❌ |
| break_even.view | ✅ | ✅ | ❌ | ❌ | ❌ |
| team.invite | ✅ | ✅ | ✅ | ❌ | ❌ |
| team.edit_roles | ✅ | ✅ | ❌ | ❌ | ❌ |

### Clinic Roles

| Recurso | admin | doctor | assistant | receptionist | viewer |
|---------|:-----:|:------:|:---------:|:------------:|:------:|
| patients.delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| treatments.mark_paid | ✅ | ❌ | ❌ | ✅ | ❌ |
| prescriptions.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| quotes.send | ✅ | ❌ | ❌ | ✅ | ❌ |
| supplies.manage_stock | ✅ | ❌ | ✅ | ❌ | ❌ |

---

## Riesgos y Rollback

### Riesgos
- Usuarios existentes sin rol explícito: Se tratan como "owner" (backward compatible)
- Performance en verificación de permisos: Cache en cliente con SWR

### Rollback
Si algo falla, revertir migraciones en orden inverso:
```sql
-- Rollback 72
DROP FUNCTION IF EXISTS is_clinic_member CASCADE;
DROP FUNCTION IF EXISTS is_clinic_admin CASCADE;
DROP FUNCTION IF EXISTS user_has_clinic_access CASCADE;

-- Rollback 71
TRUNCATE role_permissions;

-- Rollback 70
DROP TABLE IF EXISTS custom_role_templates CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP FUNCTION IF EXISTS check_user_permission CASCADE;
DROP FUNCTION IF EXISTS has_permission CASCADE;
DROP FUNCTION IF EXISTS get_user_permissions CASCADE;
```

---

## Siguientes Pasos

- [ ] Configurar envío de emails de invitación (Resend/SendGrid)
- [ ] Agregar link a Team Settings en navegación de Settings
- [ ] Integrar `<Can>` en módulos existentes para ocultar acciones
- [ ] Proteger APIs existentes con `withPermission` middleware

---

## Funciones SQL Creadas

| Función | Descripción |
|---------|-------------|
| `check_user_permission(user_id, clinic_id, resource, action)` | Verifica permiso completo |
| `has_permission(clinic_id, resource, action)` | Wrapper con `auth.uid()` |
| `get_user_permissions(user_id, clinic_id)` | Retorna todos los permisos como JSONB |
| `is_clinic_member(clinic_id)` | Verifica si usuario es miembro |
| `is_clinic_admin(clinic_id)` | Verifica si usuario es admin |
| `user_has_clinic_access(clinic_id)` | Alias para compatibilidad |

---

## Tablas Creadas/Modificadas

### Nueva: `custom_role_templates`
Roles personalizados por workspace.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary key |
| workspace_id | UUID | FK a workspaces |
| name | VARCHAR(100) | Nombre del rol |
| slug | VARCHAR(100) | Slug único |
| permissions | JSONB | Permisos del rol |
| scope | VARCHAR(20) | 'workspace' o 'clinic' |
| is_active | BOOLEAN | Estado |

### Nueva: `role_permissions`
Matriz de permisos base por rol.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary key |
| role | VARCHAR(50) | Nombre del rol |
| scope | VARCHAR(20) | 'workspace' o 'clinic' |
| resource | VARCHAR(100) | Recurso (patients, treatments, etc.) |
| action | VARCHAR(50) | Acción (view, create, edit, delete) |
| allowed | BOOLEAN | Si está permitido |

### Modificada: `workspace_users`
Campos agregados:
- `allowed_clinics UUID[]` - Clínicas con acceso (vacío = todas)
- `custom_permissions JSONB` - Override de permisos
- `custom_role_id UUID` - Referencia a rol custom

### Modificada: `clinic_users`
Campos agregados:
- `custom_permissions JSONB` - Override de permisos
- `custom_role_id UUID` - Referencia a rol custom

### Modificada: `invitations`
Campos agregados:
- `clinic_ids UUID[]` - Múltiples clínicas
- `custom_permissions JSONB` - Permisos personalizados
- `message TEXT` - Mensaje personalizado
- `resent_count INTEGER` - Contador de reenvíos
- `last_resent_at TIMESTAMPTZ` - Último reenvío
