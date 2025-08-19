# INSTRUCCIONES DE INSTALACIÓN DE SCRIPTS SUPABASE

## Orden de Ejecución

Ejecuta los scripts en el Dashboard de Supabase (SQL Editor) en este orden exacto:

### 1. Verificar qué ya existe
Primero verifica si ya tienes tablas creadas:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspaces', 'clinics', 'workspace_users', 'clinic_users', 'invitations');
```

### 2. Si las tablas NO existen, ejecutar en orden:
1. `01-workspaces-clinics-schema.sql` - Crea workspaces y clinics
2. `02-users-roles-permissions.sql` - Crea sistema de usuarios y roles
3. `03-invitation-functions.sql` - Crea funciones de invitación

### 3. Si las tablas YA existen, ejecutar:
1. `04-fix-existing-schema.sql` - Actualiza esquema sin duplicar

## Verificación Post-Instalación

Después de ejecutar los scripts, verifica que todo esté correcto:

```sql
-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workspaces', 'clinics', 'workspace_users', 'clinic_users', 'invitations');

-- Verificar funciones creadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%workspace%' OR routine_name LIKE '%invitation%';

-- Verificar políticas RLS
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';
```

## Crear Primer Workspace (Después de Login)

Una vez que un usuario se registre, puede crear su primer workspace:

```sql
-- Desde la aplicación, después de login
SELECT public.create_workspace_with_owner(
  'Mi Clínica Dental',
  'mi-clinica-dental',
  'Primera clínica del sistema'
);
```

## Invitar Usuarios

Para invitar usuarios a un workspace:

```sql
-- Invitar como administrador del workspace
SELECT public.invite_user_to_workspace(
  'workspace-uuid-aqui',
  'doctor@ejemplo.com',
  'admin',
  NULL, -- Sin clínica específica
  '{}'::jsonb -- Permisos adicionales
);

-- Invitar a clínica específica como doctor
SELECT public.invite_user_to_workspace(
  'workspace-uuid-aqui',
  'doctor@ejemplo.com',
  'doctor',
  'clinic-uuid-aqui',
  '{"can_prescribe": true}'::jsonb
);
```

## Aceptar Invitación

El usuario invitado debe:
1. Registrarse con el email invitado
2. Aceptar la invitación con el token recibido:

```sql
SELECT public.accept_invitation('token-de-invitacion-aqui');
```

## Gestión de Roles

```sql
-- Cambiar rol de usuario
SELECT public.change_user_role(
  'workspace-uuid',
  'user-uuid',
  'admin', -- nuevo rol
  NULL -- o clinic-uuid si es para clínica específica
);

-- Remover usuario
SELECT public.remove_user_from_workspace(
  'workspace-uuid',
  'user-uuid',
  NULL -- o clinic-uuid
);

-- Transferir ownership
SELECT public.transfer_workspace_ownership(
  'workspace-uuid',
  'new-owner-user-uuid'
);
```

## Obtener Workspaces del Usuario

```sql
-- Ver todos los workspaces y clínicas del usuario actual
SELECT * FROM public.get_user_workspaces();
```

## Roles Disponibles

### Workspace Roles:
- `owner` - Propietario único, todos los permisos
- `admin` - Administrador, puede gestionar usuarios y configuración
- `member` - Miembro regular, acceso completo a datos
- `viewer` - Solo lectura

### Clinic Roles:
- `admin` - Administrador de clínica
- `doctor` - Doctor/Dentista
- `assistant` - Asistente dental
- `receptionist` - Recepcionista
- `viewer` - Solo lectura

## Troubleshooting

### Error: "relation already exists"
- Usa el script `04-fix-existing-schema.sql` en lugar de los scripts individuales

### Error: "permission denied"
- Asegúrate de ejecutar los scripts como superadmin en Supabase

### Error: "Usuario no autenticado"
- Las funciones requieren que el usuario esté logueado (auth.uid() no null)

## Notas Importantes

1. **Multi-tenancy**: Todos los datos están aislados por workspace_id y clinic_id
2. **RLS**: Row Level Security está habilitado en todas las tablas
3. **Soft Delete**: Los usuarios no se eliminan, solo se marcan como inactivos
4. **Invitaciones**: Expiran en 7 días por defecto
5. **Límites**: Por defecto 10 usuarios y 3 clínicas por workspace (configurable)