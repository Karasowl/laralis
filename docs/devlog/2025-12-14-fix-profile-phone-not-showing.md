# Fix: Teléfono no aparecía en Cuenta/Perfil

**Fecha**: 2025-12-14
**Tipo**: Bug Fix P1
**Área**: Profile Management
**Archivos modificados**: 1

---

## Contexto

El usuario reportó que aunque configuraba un teléfono en su perfil, este no aparecía en la página de Cuenta (Settings > Account). El campo mostraba "Sin teléfono" a pesar de haberse guardado correctamente.

## Problema

Existía un **mismatch crítico** entre dónde se guardaba el teléfono y dónde se leía:

- **Se guardaba en**: `auth.users.phone` (campo de autenticación de Supabase)
- **Se leía desde**: `auth.users.user_metadata.phone` (metadatos del usuario)

Esto causaba que el valor nunca se mostrara correctamente en la UI.

## Causa Raíz

En `ProfileClient.tsx`:

```typescript
// ❌ ANTES - Guardaba en campo phone (auth)
await supabase.auth.updateUser({
  data: {
    first_name: formData.first_name,
    last_name: formData.last_name,
    full_name: `${formData.first_name} ${formData.last_name}`.trim(),
  },
  phone: formData.phone || undefined,  // ← Campo de auth, NO metadata
})
```

Pero la UI leía desde metadata:

```typescript
// Lectura en account/page.tsx:141
value={user?.user_metadata?.phone || tProfile('noPhone')}

// Lectura en profile/page.tsx:37
value: user?.user_metadata?.phone || t('profile.noPhone')
```

**Resultado**: Data loss silencioso - el teléfono se guardaba pero nunca se recuperaba.

## Qué Cambió

### Archivo Modificado

**`web/app/profile/ProfileClient.tsx`** (3 cambios):

1. **Línea 25** - Inicialización del estado:
```typescript
// ANTES
phone: user?.phone || '',

// DESPUÉS
phone: user?.user_metadata?.phone || '',
```

2. **Línea 40-47** - Guardado del teléfono:
```typescript
// ANTES
await supabase.auth.updateUser({
  data: { ... },
  phone: formData.phone || undefined,
})

// DESPUÉS
await supabase.auth.updateUser({
  data: {
    ...
    phone: formData.phone || '',
  },
})
```

3. **Línea 100** - Reset al cancelar:
```typescript
// ANTES
phone: user?.phone || '',

// DESPUÉS
phone: user?.user_metadata?.phone || '',
```

### Archivos Verificados (Sin Cambios)

- ✅ `web/app/settings/account/page.tsx:141` - Ya leía de `user_metadata.phone`
- ✅ `web/app/profile/page.tsx:37` - Ya leía de `user_metadata.phone`

## Antes vs Después

### ANTES

1. Usuario edita teléfono → "555-1234"
2. Click en "Guardar"
3. Se ejecuta `updateUser({ phone: "555-1234" })` (campo auth)
4. Teléfono se guarda en `auth.users.phone`
5. UI lee de `user.user_metadata.phone` → `null`
6. Se muestra "Sin teléfono"

### DESPUÉS

1. Usuario edita teléfono → "555-1234"
2. Click en "Guardar"
3. Se ejecuta `updateUser({ data: { phone: "555-1234" } })` (metadata)
4. Teléfono se guarda en `auth.users.user_metadata.phone`
5. UI lee de `user.user_metadata.phone` → "555-1234"
6. Se muestra "555-1234" correctamente

## Cómo Probar

### Verificación Manual

1. Ir a Settings > Account
2. Verificar que el teléfono actual aparece (si existe)
3. Click en "Editar" en la card de Información Personal
4. Modificar el teléfono (ej: "555-1234")
5. Click en "Guardar"
6. Verificar que el teléfono aparece en la card de resumen de la izquierda
7. Refrescar la página (F5)
8. Verificar que el teléfono persiste

### Verificación en DevTools

```javascript
// Console del navegador
const user = await (await fetch('/api/auth/user')).json()
console.log(user.user_metadata.phone) // Debe mostrar el teléfono
console.log(user.phone) // Puede estar vacío (OK)
```

### Edge Cases Verificados

- ✅ Teléfono vacío → Muestra "Sin teléfono"
- ✅ Teléfono con espacios → Se guarda correctamente
- ✅ Cancelar edición → Mantiene valor anterior
- ✅ Refresh de página → Persiste el valor

## Riesgos y Rollback

### Riesgos

**RIESGO BAJO** - Este fix no afecta:
- ✅ Otros campos del perfil (first_name, last_name, full_name)
- ✅ Sistema de autenticación
- ✅ RLS policies
- ✅ Otras partes de la aplicación

**Posible impacto**:
- ⚠️ Usuarios que guardaron teléfonos en `auth.users.phone` (campo legacy) NO verán el teléfono hasta que lo vuelvan a guardar

### Rollback

Si se necesita revertir:

```bash
git revert <commit-hash>
```

O editar manualmente `ProfileClient.tsx`:
1. Cambiar `user_metadata.phone` → `phone` en líneas 25, 45, 100
2. Mover `phone` de `data` a campo directo en `updateUser`

### Migración de Datos Legacy (Opcional)

Si hay usuarios con teléfonos en el campo legacy `phone`, crear migración:

```sql
-- Solo si es necesario migrar datos históricos
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data ||
  jsonb_build_object('phone', phone)
WHERE phone IS NOT NULL
  AND (raw_user_meta_data->>'phone') IS NULL;
```

## Siguientes Pasos

- [x] Fix implementado y probado
- [ ] Monitorear logs post-deploy (verificar que no hay errores al guardar)
- [ ] Considerar migración de datos legacy si hay reportes de teléfonos perdidos
- [ ] Documentar en TROUBLESHOOTING.md si aparecen más casos

## Referencias

- **Supabase Auth Docs**: https://supabase.com/docs/reference/javascript/auth-updateuser
- **User Metadata**: El campo `data` en `updateUser` mapea a `raw_user_meta_data` en la DB
- **Standards**: CODING-STANDARDS.md - No hardcoded strings, type safety

## Lecciones Aprendidas

1. **Always verify data flow**: Donde se guarda ≠ donde se lee = bug silencioso
2. **Supabase Auth API nuance**: `phone` field vs `data.phone` son dos lugares diferentes
3. **User metadata is canonical**: Para custom fields, usar `user_metadata` es más portable
4. **Test the full cycle**: Guardar → Refrescar → Leer es crítico para validar persistencia

---

**Estado**: ✅ Resuelto
**Impacto**: P1 - UX degradado (dato no visible)
**Complejidad**: Baja (3 líneas cambiadas)
**Testing**: Manual (no requiere tests unitarios)
