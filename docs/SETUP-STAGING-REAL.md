# Setup Real de Staging - Guía Práctica

Esta guía te lleva **paso a paso** para tener staging funcionando DE VERDAD, no teoría.

Al final tendrás:
- ✅ URLs reales de staging para probar
- ✅ Base de datos separada de producción
- ✅ Cambios que puedes probar antes de deployar
- ✅ Preview automático de cada PR

---

## 🎯 Objetivo Final

```
ANTES (ahora):
├── Local (tu máquina)
└── ??? No hay staging, no puedes probar

DESPUÉS (en 30 minutos):
├── Local (tu máquina) → http://localhost:3000
├── Staging (preview) → https://laralis-git-feature-xxx.vercel.app
└── Production (live)  → https://tu-dominio.com
```

---

## 📋 Checklist Rápido

Marca lo que ya tienes:
- [ ] Cuenta en GitHub
- [ ] Repositorio del proyecto en GitHub
- [ ] Cuenta en Supabase (gratuita)
- [ ] Cuenta en Vercel (gratuita)
- [ ] Git instalado localmente

**¿Todo listo?** Vamos al paso 1.

---

## Paso 1: Crear Proyectos en Supabase (15 min)

### 1.1 - Crear Proyecto Development

1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click en **"New Project"**
3. Llénalo así:
   ```
   Name: Laralis Development
   Database Password: [genera uno seguro]
   Region: [el más cercano a ti]
   ```
4. Click **"Create new project"**
5. **ESPERA 2-3 minutos** mientras se crea

### 1.2 - Guardar Credenciales Development

Cuando termine:

1. Ve a **Settings** → **API**
2. Copia estos 3 valores:

```
Project URL: https://xxx.supabase.co
anon public: eyJhbG...
service_role: eyJhbG... (click "Reveal" primero)
```

3. **Guárdalos** en un archivo temporal (Notepad)
4. Etiquétalos: "DEVELOPMENT"

### 1.3 - Crear Proyecto Staging

**Repite los pasos 1.1 y 1.2** pero con:
```
Name: Laralis Staging
```

Guarda estas credenciales etiquetadas "STAGING"

### 1.4 - Copiar Esquema a Staging

Necesitas que Staging tenga las **mismas tablas** que Development.

**Opción A - Si ya tienes tablas en Development**:

1. En **Development** → SQL Editor
2. Ejecuta:
   ```sql
   -- Ver el schema completo
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public';
   ```
3. Para cada tabla, obtén el DDL:
   - Dashboard → Table Editor
   - Click en la tabla
   - Click en "⋮" → "View definition" → Copiar

4. En **Staging** → SQL Editor:
   - Pega el CREATE TABLE de cada una
   - Ejecuta

**Opción B - Crear schema desde cero**:

1. Corre tus scripts de migración en ambos proyectos
2. Ejemplo: Si tienes `migrations/001_initial.sql`, córrelo en ambos

**Pro Tip**:
```bash
# Guarda este script para futuras migraciones
E:\dev-projects\laralis\scripts\sync-schema-to-staging.sql
```

---

## Paso 2: Configurar Vercel (10 min)

### 2.1 - Conectar Repositorio

1. Ve a [vercel.com](https://vercel.com)
2. Sign in con GitHub
3. Click **"Add New..."** → **"Project"**
4. Busca tu repo: `laralis`
5. Click **"Import"**

### 2.2 - Configurar Environment Variables

**IMPORTANTE**: Aquí defines QUÉ base de datos usa cada ambiente.

#### Para Production:

1. En Vercel, antes de deployar
2. Sección **"Environment Variables"**
3. Agrega estas 3:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: [tu URL de Staging por ahora, cambiarás a Prod después]
Environment: Production

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [tu anon key de Staging]
Environment: Production

Name: SUPABASE_SERVICE_ROLE_KEY
Value: [tu service_role key de Staging]
Environment: Production
```

4. Click **"Add"** para cada una

#### Para Preview (Staging):

**Repite** pero seleccionando **"Preview"** en Environment.

Usa las **credenciales de Staging**.

### 2.3 - Deploy Inicial

1. Deja las otras opciones por defecto
2. Click **"Deploy"**
3. **ESPERA 2-3 minutos**

Verás:
```
Building...
✓ Build completed
✓ Deploying...
🎉 Deployment ready!

https://laralis-xxx.vercel.app
```

**GUARDA ESA URL** - es tu staging inicial.

---

## Paso 3: Probar que Funciona (5 min)

### 3.1 - Visita tu Staging

1. Abre la URL que te dio Vercel
2. Deberías ver tu app funcionando
3. **Pero**: está conectada a **Staging database** (vacía)

### 3.2 - Crear Usuario de Prueba

1. En tu staging URL, ve a `/auth/register`
2. Registra un usuario:
   ```
   Email: test@staging.com
   Password: test123456
   ```

3. Verifica en Supabase Staging:
   - Dashboard → Authentication → Users
   - Deberías ver `test@staging.com` ✅

4. **Comprueba en Production DB**:
   - Dashboard → Authentication → Users (en el proyecto Development)
   - NO debería estar ahí ✅

**¡Funciona! Ya tienes ambientes separados.**

---

## Paso 4: Workflow Real de Desarrollo

Ahora el workflow REAL que vas a usar día a día:

### Escenario: Quieres agregar una nueva tabla

#### 4.1 - Crear el Cambio Localmente

```bash
# 1. Crear branch
git checkout -b feature/agregar-tabla-pacientes

# 2. Crear script de migración
# Archivo: scripts/migrations/002_add_patients.sql
```

```sql
-- scripts/migrations/002_add_patients.sql
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clinic patients"
  ON patients FOR SELECT
  USING (clinic_id IN (
    SELECT id FROM clinics WHERE owner_id = auth.uid()
  ));
```

#### 4.2 - Probar Localmente

```bash
# 1. Ejecuta la migración en tu DB local/development
# Supabase Dashboard → SQL Editor → pega el script → Run

# 2. Modifica el código frontend para usar la nueva tabla

# 3. Prueba local
npm run dev

# 4. Crea algunos pacientes de prueba
# Verifica que funcionen
```

#### 4.3 - Commit y Push

```bash
git add .
git commit -m "feat: agregar módulo de pacientes"
git push origin feature/agregar-tabla-pacientes
```

#### 4.4 - Crear Pull Request

1. Ve a GitHub
2. Verás: **"feature/agregar-tabla-pacientes had recent pushes"**
3. Click **"Compare & pull request"**
4. Completa:
   ```markdown
   ## Cambios
   - Nueva tabla `patients`
   - CRUD de pacientes

   ## Migración requerida
   Ejecutar: scripts/migrations/002_add_patients.sql
   ```

5. Click **"Create pull request"**

#### 4.5 - Preview Deploy Automático

**En 2-3 minutos**, Vercel comenta en tu PR:

```
✅ Deployment ready!
Preview: https://laralis-git-feature-agregar-tabla-xxx.vercel.app
```

#### 4.6 - Aplicar Migración en Staging

**IMPORTANTE**: El preview deploy tiene el CÓDIGO nuevo, pero la DB de staging NO tiene la tabla nueva aún.

1. Ve a Supabase **Staging**
2. SQL Editor
3. Pega `scripts/migrations/002_add_patients.sql`
4. **Run**

#### 4.7 - Probar en Preview

1. Abre la URL del preview
2. Ve a la sección de pacientes
3. Crea un paciente de prueba
4. Verifica que funcione

**¿Todo OK?** → Procede al 4.8
**¿Algo falló?** → Arregla el código, push otra vez, se actualiza el preview

#### 4.8 - Mergear a Main

1. En GitHub PR, click **"Merge pull request"**
2. **Automáticamente**:
   - Vercel deploya a Production
   - En 2-3 min la nueva versión está live

#### 4.9 - Aplicar Migración en Production

**ANTES de que tus usuarios vean errores**:

1. Ve a Supabase **Production** (o Development, el que uses para prod)
2. SQL Editor
3. Pega `scripts/migrations/002_add_patients.sql`
4. **Run**

**Timing perfecto**:
```
1. Merge PR (00:00)
2. Mientras Vercel buildea (00:00 - 02:00)
3. Aplicas migración en Prod DB (00:30)
4. Deploy termina (02:00)
5. App live con nueva feature ✅
```

---

## Paso 5: Mantener Sincronizados los Schemas

### Problema

Después de varios PRs, los schemas pueden diverger:
- Development tiene tablas A, B, C
- Staging tiene tablas A, B
- Production tiene tablas A, B, C, D

### Solución: Script de Sincronización

Crea este archivo:

```sql
-- scripts/verify-schema-sync.sql

-- Comparar tablas entre ambientes
-- Ejecuta esto en Development y Staging para compararlos

SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Proceso semanal/mensual**:

1. Ejecuta en Development → guarda resultado
2. Ejecuta en Staging → compara
3. Si difieren, aplica migraciones faltantes

---

## Paso 6: Secrets y Variables Sensibles

### NO hagas esto:

```bash
# ❌ MAL
git add .env.local
git commit -m "add env"
```

### SÍ haz esto:

#### Para Local/Development:

```bash
# Copia el ejemplo
cp .env.example .env.local

# Edita .env.local con tus credenciales REALES
# NUNCA lo commitees (ya está en .gitignore)
```

#### Para Staging/Production:

1. Ve a Vercel Dashboard
2. Tu proyecto → Settings → Environment Variables
3. **Para cada variable**, especifica el Environment:
   - Production
   - Preview
   - Development

**Ejemplo**:

```
NEXT_PUBLIC_SUPABASE_URL

Production: https://prod-xxx.supabase.co
Preview: https://staging-xxx.supabase.co
Development: https://dev-xxx.supabase.co
```

---

## Paso 7: Rollback Rápido

### Si el deploy salió mal:

#### Opción A - Revertir Deploy (1 min)

1. Vercel Dashboard → Tu proyecto → Deployments
2. Encuentra el deploy anterior (el que funcionaba)
3. Click **"⋮"** → **"Promote to Production"**
4. Listo, volviste al anterior

#### Opción B - Revertir Código (Git)

```bash
# En tu repo local
git revert HEAD
git push origin main

# Vercel auto-deploya el revert
```

#### Opción C - Revertir Migración DB

**MÁS DIFÍCIL** - Por eso siempre haz migraciones reversibles:

```sql
-- Al crear una migración
-- scripts/migrations/002_add_patients.sql

-- UP
CREATE TABLE patients (...);

-- Y también crea
-- scripts/migrations/002_add_patients_down.sql

-- DOWN
DROP TABLE IF EXISTS patients;
```

---

## Checklist Final: ¿Está Todo Listo?

Marca cada uno:

- [ ] Tengo 2 proyectos en Supabase (Dev y Staging)
- [ ] Tengo cuenta en Vercel conectada a GitHub
- [ ] Mi repo tiene un deploy en Vercel
- [ ] Vercel tiene env variables para Production y Preview
- [ ] Puedo crear un PR y ver el preview URL automáticamente
- [ ] El preview usa la DB de Staging
- [ ] Production usa la DB de Production
- [ ] Sé cómo aplicar migraciones manualmente en cada ambiente
- [ ] Probé crear un usuario en staging y NO aparece en prod ✅

**¿Todo marcado?** ¡Ya tienes staging funcionando de verdad!

---

## Flujo Día a Día (Resumen)

```bash
# 1. Crear branch
git checkout -b feature/nueva-cosa

# 2. Hacer cambios (código + migración SQL si hace falta)

# 3. Probar local
npm run dev

# 4. Si hay migración, aplicarla en Development DB
# (Supabase Dashboard → SQL Editor)

# 5. Commit y push
git push origin feature/nueva-cosa

# 6. Crear PR en GitHub

# 7. Vercel auto-crea preview deploy

# 8. Si hay migración, aplicarla en Staging DB

# 9. Probar en preview URL

# 10. Merge PR

# 11. INMEDIATAMENTE aplicar migración en Production DB

# 12. Verificar que el deploy a prod funcione
```

---

## Troubleshooting

### "El preview no se crea"

- Verifica que Vercel esté conectado a tu repo
- Check que el PR sea de un branch, no de un fork
- Mira los logs en Vercel Dashboard

### "El preview muestra errores de DB"

- ¿Aplicaste la migración en Staging DB?
- Verifica que las env vars de Preview apunten a Staging

### "Production tiene datos de staging"

- ❌ Las env vars están mal
- Ve a Vercel → Settings → Environment Variables
- Asegúrate que Production use Production DB

### "No puedo aplicar la migración"

- ¿Hay errores de syntax en el SQL?
- ¿La tabla ya existe?
- Usa `CREATE TABLE IF NOT EXISTS`

---

## Próximos Pasos Avanzados

Cuando domines esto:

1. **Supabase CLI** - Migraciones automáticas
2. **GitHub Actions** - CI/CD automatizado
3. **Database Branching** - Copias de DB por PR
4. **Supabase Edge Functions** - Backend logic
5. **Monitoring** - Sentry, LogRocket

---

**¡Ya tienes un setup REAL de staging!** 🚀

Ahora SÍ puedes:
- ✅ Hacer cambios sin romper producción
- ✅ Probar en una URL real antes de deployar
- ✅ Compartir previews con otros
- ✅ Dormir tranquilo sabiendo que hay rollback
