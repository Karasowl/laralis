# ¿Por Qué Funcionaba en Desarrollo?

## TL;DR

El onboarding funcionaba en desarrollo por una combinación de:
1. **RLS estaba DESHABILITADO** cuando se probó inicialmente
2. **Los triggers se agregaron DESPUÉS** de las pruebas iniciales
3. **Se probó con datos seed manuales** (sin pasar por onboarding)
4. **No se hizo testing end-to-end** con usuario real después de habilitar RLS

## Timeline del Problema

### Septiembre 7, 2024 - 22:09

**AMBOS scripts se crearon al mismo tiempo:**

```bash
-rw-r--r-- 1 adven 197609 20277 Sep  7 22:09 17-implement-rls-complete-fixed.sql
-rw-r--r-- 1 adven 197609 10969 Sep  7 22:09 30-patient-sources-and-referrals.sql
```

**Script 17** (`17-implement-rls-complete-fixed.sql`):
- Habilitó RLS en las tablas principales: `workspaces`, `clinics`, `patients`, `treatments`, etc.
- Agregó políticas RLS para estas tablas
- **NO incluyó** `patient_sources` ni `custom_categories` (porque se crearon simultáneamente)

**Script 30** (`30-patient-sources-and-referrals.sql`):
- Creó las tablas `patient_sources` y `custom_categories`
- Agregó triggers automáticos en `clinics`
- **NO habilitó RLS** para estas nuevas tablas
- **NO agregó políticas RLS** para estas tablas

### El Bug Latente

```
┌─────────────────────────────────────────────────────────┐
│  Sep 7: Se ejecuta script 17 (RLS en tablas core)      │
│  - workspaces, clinics, patients: RLS ON ✅             │
│  - patient_sources, custom_categories: NO EXISTEN AÚN  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Sep 7: Se ejecuta script 30 (nuevas tablas + triggers)│
│  - Crea patient_sources, custom_categories              │
│  - Agrega triggers a clinics                            │
│  - ❌ OLVIDA habilitar RLS en estas tablas              │
│  - ❌ OLVIDA agregar políticas RLS                      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Sep-Oct: Desarrollo y testing                          │
│  - Se prueban módulos individuales                      │
│  - Se agregan datos manualmente en Supabase             │
│  - ❌ NO se prueba onboarding completo end-to-end       │
│  - ❌ NO se detecta que triggers fallan con RLS         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Oct 18: Usuario real intenta onboarding               │
│  - Crea workspace ✅                                    │
│  - Crea clínica ✅                                      │
│  - Trigger insert_default_patient_sources() ❌          │
│  - Trigger insert_default_categories() ❌               │
│  - ERROR: RLS violation ❌                              │
└─────────────────────────────────────────────────────────┘
```

## ¿Por Qué Funcionó en Desarrollo?

### Razón 1: RLS Estaba Deshabilitado Inicialmente

En el desarrollo temprano, RLS estaba completamente deshabilitado. El código original (`supabase/schema.sql`) muestra:

```sql
-- RLS OFF temporal (solo DEV). Activaremos RLS en otro PR con auth
alter table public.settings_time disable row level security;
alter table public.fixed_costs disable row level security;
alter table public.supplies disable row level security;
-- ... etc
```

Durante esta fase, **TODO funcionaba** porque no había restricciones.

### Razón 2: Testing con Datos Seed Manuales

El desarrollo se hizo en módulos separados:
- Módulo de activos
- Módulo de costos fijos
- Módulo de insumos
- Módulo de servicios
- etc.

**NO se probó el flujo completo de onboarding** después de agregar los triggers.

Los datos de prueba se insertaron:
1. Manualmente en Supabase SQL Editor (usa service role, bypasea RLS)
2. Con scripts de seed (que también usan service role)
3. Directamente en las tablas (sin pasar por triggers)

### Razón 3: Los Triggers se Agregaron Tarde

Los triggers de `patient_sources` y `custom_categories` se agregaron en Septiembre 7, **DESPUÉS** de que se hicieron las pruebas iniciales del onboarding.

Secuencia probable:
```
1. Julio-Agosto: Desarrollo inicial, onboarding básico funciona
2. Septiembre 7: Se agrega RLS a tablas core ✅
3. Septiembre 7: Se agregan triggers y nuevas tablas ❌ (sin RLS)
4. Septiembre-Octubre: Testing de módulos individuales (no onboarding)
5. Octubre 18: Primera prueba real de onboarding completo → FALLA
```

### Razón 4: No Había Testing E2E Automatizado

No existían tests end-to-end que verificaran:
- Registro de nuevo usuario
- Completar onboarding completo
- Verificar que triggers se ejecutan correctamente
- Verificar que datos por defecto se crean

Si hubiera habido un test E2E, habría detectado esto inmediatamente.

## Cómo se Detectó Finalmente

1. **Usuario real** intenta registrarse y hacer onboarding
2. Falla con error genérico: "Hubo un problema al crear tu configuración"
3. Se mejora logging para ver error real
4. Error real: `"new row violates row-level security policy for table \"custom_categories\""`
5. Se descubren los triggers
6. Se descubre que faltan políticas RLS
7. Se crea el fix

## Lecciones Aprendidas

### 1. Testing E2E es Crítico

**Antes:**
- Testing manual de módulos individuales
- Datos seed directos en DB
- No se probó flujo completo

**Después:**
- Agregar tests E2E para onboarding completo
- Probar con usuario real, no con service role
- Verificar que triggers funcionan

### 2. RLS Debe Incluirse Desde el Inicio

**Antes:**
```sql
CREATE TABLE custom_categories (...);
-- Olvido de agregar RLS
```

**Después:**
```sql
CREATE TABLE custom_categories (...);
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
-- Agregar políticas inmediatamente
```

### 3. Triggers Necesitan Políticas RLS

**Antes:**
- Se agregan triggers
- Se olvida que triggers necesitan políticas RLS
- Se asume que "funciona si la clínica se crea"

**Después:**
- Al agregar trigger que inserta en tabla X
- Verificar que tabla X tiene políticas RLS de INSERT
- Testear trigger con usuario real

### 4. Logging Detallado Desde el Inicio

**Antes:**
```typescript
if (error) {
  return { error: 'Failed to create clinic' }
}
```

**Después:**
```typescript
if (error) {
  console.error('Error details:', {
    error,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  })
  return {
    error: 'Failed to create clinic',
    details: error.message,
    code: error.code
  }
}
```

## Prevención Futura

### Checklist al Agregar Nuevas Tablas

- [ ] Crear tabla
- [ ] Habilitar RLS: `ALTER TABLE X ENABLE ROW LEVEL SECURITY;`
- [ ] Agregar políticas SELECT, INSERT, UPDATE, DELETE
- [ ] Si hay triggers que insertan en esta tabla, verificar que las políticas permiten esas inserciones
- [ ] Agregar test E2E que use la tabla
- [ ] Probar con usuario real (no service role)

### Checklist al Agregar Triggers

- [ ] Identificar qué tablas modifica el trigger
- [ ] Verificar que esas tablas tienen RLS habilitado
- [ ] Verificar que existen políticas RLS para las operaciones del trigger
- [ ] Testear trigger con usuario real autenticado
- [ ] Verificar que trigger funciona en contexto de RLS

## Conclusión

**El bug estaba latente desde Septiembre 7**, pero solo se manifestó cuando:
1. Un usuario REAL (no desarrollador)
2. Intentó hacer el onboarding COMPLETO (no módulos aislados)
3. Con RLS HABILITADO (no en modo desarrollo)
4. Sin datos seed previos (fresh start)

Es un excelente ejemplo de por qué **testing end-to-end con condiciones reales** es crítico, especialmente cuando se trabaja con seguridad (RLS).

---

**Moraleja**: Si algo funciona en desarrollo pero falla en producción, probablemente es porque:
- Desarrollo usa privilegios elevados (service role)
- Testing se hace con datos seed (no flujo real)
- No hay tests E2E automatizados
- Las condiciones de seguridad difieren
