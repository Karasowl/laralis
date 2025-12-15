# Instrucciones: Ejecutar Migración de Push Notifications en Supabase

## Archivo a ejecutar

**Ubicación**: `E:\dev-projects\laralis\supabase\migrations\65_push_notifications.sql`

## Pasos

### 1. Abrir Supabase SQL Editor

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Click en **SQL Editor** en la barra lateral
3. Click en **New Query** para crear una nueva query

### 2. Copiar y Pegar el Script

1. Abre el archivo `supabase/migrations/65_push_notifications.sql`
2. Copia **TODO** el contenido del archivo
3. Pégalo en el editor SQL de Supabase

### 3. Ejecutar la Migración

1. Click en el botón **Run** (o presiona `Ctrl+Enter` / `Cmd+Enter`)
2. Espera a que se complete la ejecución
3. Verifica que no haya errores en la consola

### 4. Verificar que se crearon las tablas

En el SQL Editor, ejecuta:

```sql
-- Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('push_subscriptions', 'push_notifications');
```

**Resultado esperado**: Debe mostrar 2 filas con las tablas `push_subscriptions` y `push_notifications`

### 5. Verificar RLS Policies

```sql
-- Verificar policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('push_subscriptions', 'push_notifications');
```

**Resultado esperado**: Debe mostrar varias policies (5+ filas)

### 6. Verificar Indexes

```sql
-- Verificar indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('push_subscriptions', 'push_notifications');
```

**Resultado esperado**: Debe mostrar 5+ indexes

## Troubleshooting

### Error: "relation already exists"
→ La migración ya fue ejecutada anteriormente. Puedes ignorar este error.

### Error: "permission denied"
→ Verifica que estés usando el proyecto correcto en Supabase.

### Error: "function gen_random_uuid() does not exist"
→ Ejecuta: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

## Siguiente Paso

Después de ejecutar la migración:

1. Genera VAPID keys (cuando estés listo para activar push delivery):
   ```bash
   cd web
   npx web-push generate-vapid-keys
   ```

2. Agrega las keys a `.env.local`:
   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCf...xyz
   VAPID_PRIVATE_KEY=abc...123
   ```

3. (Opcional) Instala web-push library:
   ```bash
   npm install web-push
   ```

4. Visita `/settings/notifications` en la app para activar push notifications

---

**Nota**: Por ahora el sistema solo guarda subscripciones en la base de datos. Para enviar notificaciones reales, necesitas instalar `web-push` (requiere aprobación).
