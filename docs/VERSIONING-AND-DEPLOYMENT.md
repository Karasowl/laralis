# Sistema de Versionamiento y Despliegue - Laralis

Este documento describe el flujo de trabajo completo para desarrollar, versionar y desplegar la aplicación Laralis de manera profesional y segura.

---

## 🎯 Objetivo

Poder **desarrollar y cambiar cosas** sin afectar:
- La aplicación en producción (lo que ven tus usuarios)
- La base de datos principal

Y con un **paso simple** hacer que la nueva versión aparezca en la app.

---

## 📋 Sistema de 3 Ambientes

### 1. **Development** (Local)
**Dónde**: Tu computadora
**Para qué**: Experimentar libremente, probar nuevas features
**Base de datos**: Supabase proyecto "Development" (separado)

### 2. **Staging** (Preview/Testing)
**Dónde**: Servidor en la nube (Vercel/Netlify)
**Para qué**: Probar antes de lanzar a producción
**Base de datos**: Supabase proyecto "Staging" (separado)
**Acceso**: Solo tú y tu equipo

### 3. **Production** (Live)
**Dónde**: Servidor en la nube
**Para qué**: Lo que usan tus clientes reales
**Base de datos**: Supabase proyecto "Production"
**Acceso**: Público

---

## 🔄 Flujo de Trabajo Completo

### Paso 1: Desarrollar Localmente

```bash
# En tu máquina
git checkout -b feature/nueva-funcionalidad

# Trabaja en tu código...
# Los cambios solo afectan tu máquina local

# Prueba localmente
npm run dev

# Conecta a tu DB de Development (ver .env.local.example)
```

**¿Qué pasa?**
- ✅ Cambias código sin miedo
- ✅ Tu DB local/staging no afecta a producción
- ✅ Puedes romper cosas y arreglarlas

---

### Paso 2: Actualizar Versión

Cuando terminas una feature y está lista:

```bash
# 1. Actualizar versión en package.json
# Para cambios menores (features nuevas):
# 0.1.0 → 0.2.0

# 2. Actualizar CHANGELOG.md
# Agrega tus cambios bajo ## [0.2.0] - 2025-XX-XX

# 3. Actualizar traducciones
# Edita messages/en.json y messages/es.json
# Sección "version.releases.0.2.0"
```

**Tipos de versión (Semantic Versioning)**:
- **MAJOR** (1.0.0 → 2.0.0): Cambios que rompen compatibilidad
- **MINOR** (0.1.0 → 0.2.0): Nueva funcionalidad compatible
- **PATCH** (0.1.0 → 0.1.1): Bug fixes

---

### Paso 3: Commit y Push

```bash
# Commit con mensaje descriptivo
git add .
git commit -m "feat: agregar módulo de pacientes v0.2.0"

# Push a GitHub
git push origin feature/nueva-funcionalidad
```

---

### Paso 4: Crear Pull Request

**En GitHub**:
1. Ve a tu repositorio
2. Click en "Pull Requests" → "New Pull Request"
3. Selecciona tu branch → `main`
4. Completa la descripción:
   ```markdown
   ## Cambios
   - Nueva funcionalidad X
   - Fix de bug Y

   ## Versión
   0.2.0

   ## Testing
   - [x] Probado localmente
   - [x] Tests pasando
   - [ ] Probado en staging
   ```

---

### Paso 5: Deploy Automático (Staging)

**Con Vercel/Netlify**:
- Cuando haces el PR, automáticamente se crea un deploy de "preview"
- URL única: `https://laralis-pr-123.vercel.app`
- Conectado a tu DB de Staging

**Prueba ahí**:
- Verifica que todo funcione
- Muestra a otras personas si quieres feedback

---

### Paso 6: Merge y Deploy a Producción

**Cuando todo está OK**:

```bash
# 1. Hacer merge del PR en GitHub
# Click en "Merge Pull Request"

# 2. Deploy automático a producción
# Vercel/Netlify detecta el merge a main
# Automáticamente deploya la nueva versión

# 3. Tu app en producción se actualiza
# Usuarios ven la nueva versión
```

**¡LISTO!** Con un simple **merge** la nueva versión está en producción.

---

## 🏗️ Setup Inicial (Una Sola Vez)

### A. Crear Proyectos en Supabase

Necesitas **2-3 proyectos**:

1. **Laralis Development**
   - Para desarrollo local
   - Puedes resetear cuando quieras

2. **Laralis Staging** (opcional pero recomendado)
   - Para pruebas antes de producción
   - Copia de la estructura de producción

3. **Laralis Production**
   - La base de datos real de tus clientes
   - **NUNCA** la resetees sin backup

### B. Configurar Variables de Entorno

Crea estos archivos en `web/`:

**`.env.local`** (Development - NO commitear):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx-development.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...development
```

**`.env.staging`** (Staging - NO commitear):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...staging
```

**`.env.production`** (Production - en Vercel/Netlify):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx-production.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...production
```

### C. Configurar Deploy en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Production Branch**: `main`
   - **Environment Variables**: Pega las de `.env.production`
4. Deploy!

**Vercel hará**:
- Deploy automático cuando haces push a `main`
- Preview deploys para cada PR
- SSL automático
- CDN global

---

## 📱 Cómo Ver la Versión en la App

Los usuarios pueden ver la versión actual:

1. En el **sidebar** (izquierda abajo):
   - Aparece un badge: `v0.2.0`

2. Al **hacer click**:
   - Se abre un modal con el changelog
   - Muestra todos los cambios en su idioma
   - Organizado por categorías (Agregado, Mejorado, Corregido, etc.)

3. **Traducciones automáticas**:
   - Si el usuario tiene la app en español: ve el changelog en español
   - Si está en inglés: ve el changelog en inglés

---

## 📝 Mantener el Changelog Actualizado

**Cada vez que lances una versión nueva**:

### 1. Actualiza `CHANGELOG.md`:

```markdown
## [0.3.0] - 2025-11-15

### ✨ Agregado
- Módulo de pacientes con historial clínico
- Exportación de reportes a PDF

### 🔧 Mejorado
- Performance del dashboard mejorada 50%
- Formularios más rápidos

### 🐛 Corregido
- Bug de duplicación de servicios
- Error en cálculo de impuestos
```

### 2. Actualiza `messages/es.json`:

```json
"version": {
  "releases": {
    "0.3.0": {
      "date": "15 de Noviembre, 2025",
      "title": "Módulo de Pacientes y Reportes",
      "added": [
        "Módulo de pacientes con historial clínico completo",
        "Exportación de reportes a PDF con logo personalizado"
      ],
      "improved": [
        "Performance del dashboard mejorada 50%",
        "Formularios más rápidos y responsivos"
      ],
      "fixed": [
        "Corregido bug de duplicación de servicios",
        "Arreglado error en cálculo de impuestos"
      ]
    }
  }
}
```

### 3. Actualiza `messages/en.json`:

```json
"version": {
  "releases": {
    "0.3.0": {
      "date": "November 15, 2025",
      "title": "Patients Module & Reports",
      "added": [
        "Patients module with complete clinical history",
        "PDF report export with custom logo"
      ],
      "improved": [
        "Dashboard performance improved 50%",
        "Forms are faster and more responsive"
      ],
      "fixed": [
        "Fixed service duplication bug",
        "Fixed tax calculation error"
      ]
    }
  }
}
```

### 4. Actualiza `package.json`:

```json
{
  "version": "0.3.0"
}
```

---

## 🚀 Comandos Útiles

```bash
# Desarrollo local
npm run dev

# Build para producción (probar antes de deploy)
npm run build
npm run start

# Tests antes de commitear
npm run test
npm run lint

# Ver qué se va a deployar
git status
git diff
```

---

## ⚠️ Precauciones Importantes

### ❌ NUNCA Hagas Esto:

1. **NO cambies directamente en `main`**
   ```bash
   # ❌ MAL
   git checkout main
   git add .
   git commit -m "cambios"
   git push
   ```

2. **NO uses la base de datos de producción para desarrollo**
   - Siempre usa Development o Staging

3. **NO hagas push de archivos `.env`**
   - Están en `.gitignore` por seguridad
   - Cada ambiente tiene sus propias variables

4. **NO resetees la base de datos de producción**
   - Usa scripts de migración, no `TRUNCATE`

### ✅ SÍ Haz Esto:

1. **Siempre crea un branch nuevo**
   ```bash
   git checkout -b feature/mi-feature
   ```

2. **Prueba localmente antes de commitear**
   ```bash
   npm run dev
   npm run test
   ```

3. **Haz commits pequeños y descriptivos**
   ```bash
   git commit -m "feat: agregar validación de email"
   ```

4. **Revisa el preview deploy antes de mergear**

---

## 🔄 Ejemplo Completo de Flujo

```bash
# 1. Crear branch para nueva feature
git checkout -b feature/modulo-pacientes

# 2. Desarrollar (días/semanas)
# ... código ...

# 3. Actualizar versión
# Editar package.json: "0.1.0" → "0.2.0"
# Editar CHANGELOG.md
# Editar messages/es.json y messages/en.json

# 4. Commit
git add .
git commit -m "feat: agregar módulo de pacientes v0.2.0

- CRUD completo de pacientes
- Historial clínico
- Búsqueda avanzada
- Exportación a Excel
"

# 5. Push
git push origin feature/modulo-pacientes

# 6. Crear PR en GitHub
# Ir a github.com → Pull Requests → New

# 7. Vercel crea preview
# URL: https://laralis-pr-45.vercel.app
# Prueba aquí antes de mergear

# 8. Todo OK → Merge PR
# Click "Merge" en GitHub

# 9. Deploy automático a producción
# Vercel detecta el merge y deploya
# En 2-3 minutos la nueva versión está live

# 10. Usuarios ven v0.2.0
# Click en badge de versión → ven el changelog
```

---

## 📊 Ventajas de Este Sistema

✅ **Desarrollo seguro**: Tu código local no afecta a producción
✅ **Testing antes de lanzar**: Preview deploys para probar
✅ **Rollback fácil**: Si algo falla, revertir en 1 click
✅ **Changelog automático**: Los usuarios ven qué cambió
✅ **Multiidioma**: Changelog en español e inglés
✅ **Deploy con 1 click**: Merge = Deploy automático
✅ **Sin downtime**: Zero-downtime deployments

---

## 🆘 Troubleshooting

### "El preview deploy no funciona"
- Verifica que las env variables estén configuradas en Vercel
- Check que el branch tenga un PR abierto

### "La versión no se actualiza en la app"
- Hard refresh: Ctrl + Shift + R
- Verifica que `package.json` tenga la versión correcta
- Check que las traducciones estén en `messages/*.json`

### "No puedo hacer merge"
- Resuelve conflictos primero
- Asegúrate que los tests pasen
- Pide review si es necesario

---

## 📚 Referencias

- [Semantic Versioning](https://semver.org/lang/es/)
- [Keep a Changelog](https://keepachangelog.com/es-ES/)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Multi-environment Setup](https://supabase.com/docs/guides/platform/going-into-prod)

---

## 🎓 Siguiente Nivel (Opcional)

Cuando estés listo para más automatización:

- **CI/CD con GitHub Actions**: Tests automáticos en cada PR
- **Semantic Release**: Versiones automáticas basadas en commits
- **Database Migrations**: Prisma Migrate o Supabase Migrations
- **Feature Flags**: Activar/desactivar features sin deploy
- **Rollback automático**: Si hay errores, volver atrás automáticamente

---

**¡Ya tienes un sistema de versionamiento profesional!** 🚀

Ahora puedes desarrollar con confianza sabiendo que:
- Tus cambios no rompen producción
- Puedes probar antes de lanzar
- Los usuarios saben qué es nuevo
- Todo está documentado
