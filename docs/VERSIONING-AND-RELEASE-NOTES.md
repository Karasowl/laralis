# 📋 Guía de Versionado y Notas de Lanzamiento

## 🎯 Objetivo

Esta guía explica cómo versionar la aplicación, comunicar cambios a los usuarios y mantener un registro profesional de actualizaciones.

---

## 1️⃣ VERSIONADO DE LA APLICACIÓN

### ¿Qué es Semantic Versioning (Semver)?

Usamos el sistema estándar de la industria: **MAJOR.MINOR.PATCH**

```
1.2.3
│ │ │
│ │ └─ PATCH: Arreglos de bugs (1.2.3 → 1.2.4)
│ └─── MINOR: Nuevas funcionalidades (1.2.0 → 1.3.0)
└───── MAJOR: Cambios grandes o breaking (1.0.0 → 2.0.0)
```

### Ejemplos Prácticos

| Cambio | De | A | Tipo |
|--------|----|----|------|
| Arreglé un bug en el formulario de pacientes | 1.0.0 | 1.0.1 | PATCH |
| Agregué botón "Guardar y agregar otro" | 1.0.0 | 1.1.0 | MINOR |
| Cambié completamente la arquitectura de precios | 1.0.0 | 2.0.0 | MAJOR |
| Agregué modo oscuro | 1.5.0 | 1.6.0 | MINOR |
| Corregí error de permisos | 1.6.0 | 1.6.1 | PATCH |

### ¿Dónde se guarda la versión?

**Archivo `web/package.json`**:
```json
{
  "name": "laralis-web",
  "version": "0.2.0",  // ← CAMBIAR AQUÍ
  "private": true,
  // ...
}
```

**Archivo `web/.env.local`** (crear si no existe):
```bash
NEXT_PUBLIC_APP_VERSION=0.2.0  # ← MISMO NÚMERO
```

---

## 2️⃣ CHANGELOG (Registro de Cambios)

### ¿Qué es?

Un archivo donde escribes **QUÉ cambió** en cada versión. Es como un historial profesional de tu app.

### Ubicación

**Archivo**: `CHANGELOG.md` (raíz del proyecto)

Ya existe y está configurado. Solo debes actualizarlo.

### Estructura

```markdown
## [Sin publicar]

### ✨ Agregado
- Nuevas cosas que estás desarrollando pero no has lanzado

---

## [0.3.0] - 2025-12-15

### ✨ Agregado
- Botón "Guardar y agregar otro" en formulario de tratamientos
- Modal de "Qué hay de nuevo" al entrar a la app

### 🔧 Mejorado
- Performance del cálculo de punto de equilibrio

### 🐛 Corregido
- Error al crear paciente sin email
```

### Categorías con Emojis

| Emoji | Categoría | Cuándo usar |
|-------|-----------|-------------|
| ✨ | Agregado | Nuevas funcionalidades |
| 🔧 | Mejorado | Mejoras a features existentes |
| 🐛 | Corregido | Arreglos de bugs |
| 🗑️ | Eliminado | Features removidas |
| 🔒 | Seguridad | Parches de seguridad |
| 🎨 | UI/UX | Cambios visuales |
| ⚡ | Performance | Mejoras de rendimiento |
| 📚 | Documentación | Solo docs |

---

## 3️⃣ COMUNICACIÓN A USUARIOS

### Opción 1: Modal de "Qué hay de nuevo" ✅ (YA IMPLEMENTADO)

**Ubicación**: Click en la versión en el sidebar (esquina inferior izquierda)

**Características**:
- Muestra automáticamente el historial de versiones
- Bonito, con iconos y categorías
- Los usuarios pueden verlo cuando quieran

**Cómo se ve**:
```
┌─────────────────────────────────────┐
│ ✨ Novedades                         │
├─────────────────────────────────────┤
│ Versión actual                       │
│ v0.2.0        [Qué hay de nuevo] 🟢 │
│                                      │
│ v0.2.0 - 2025-10-18                 │
│ Dark Mode Premium y Onboarding       │
│                                      │
│ ✨ Agregado                          │
│ • Dark Mode Premium                  │
│ • Wizard de Setup                    │
│                                      │
│ 🐛 Corregido                         │
│ • Loop infinito en assets            │
│ • Políticas RLS faltantes            │
└─────────────────────────────────────┘
```

### Opción 2: Toast Notification (Próximamente)

Cuando el usuario entre y detecte una nueva versión, mostrar un toast:

```
┌───────────────────────────────────┐
│ 🎉 Nueva actualización v0.3.0      │
│ Haz click aquí para ver novedades │
└───────────────────────────────────┘
```

---

## 4️⃣ PROCESO COMPLETO (PASO A PASO)

### Cuando hagas un cambio:

#### 1. Decide el tipo de versión

```bash
# Pregúntate:
# ¿Es un bug fix? → PATCH (0.2.0 → 0.2.1)
# ¿Es una nueva feature? → MINOR (0.2.0 → 0.3.0)
# ¿Rompe compatibilidad? → MAJOR (0.2.0 → 1.0.0)
```

#### 2. Actualiza `package.json`

```bash
cd web
# Editar: web/package.json
"version": "0.3.0"  # ← NUEVA VERSIÓN
```

#### 3. Actualiza `.env.local`

```bash
# Editar: web/.env.local
NEXT_PUBLIC_APP_VERSION=0.3.0  # ← MISMA VERSIÓN
```

#### 4. Actualiza `CHANGELOG.md`

```markdown
## [Sin publicar]

---

## [0.3.0] - 2025-12-15  # ← FECHA DE HOY

### ✨ Agregado
- Botón "Guardar y agregar otro" en tratamientos
- Permite crear múltiples tratamientos sin salir del formulario

### 🐛 Corregido
- Error al calcular punto de equilibrio con 0 datos
```

#### 5. Actualiza traducciones (archivo `version.es.json` y `version.en.json`)

**Archivo**: `web/messages/version.es.json`

```json
{
  "releases": {
    "v0_3_0": {  // ← NUEVA VERSIÓN (usar _ en vez de .)
      "date": "2025-12-15",
      "title": "Mejoras en Formularios",
      "added": [
        "Botón 'Guardar y agregar otro' en tratamientos",
        "Permite crear múltiples registros rápidamente"
      ],
      "fixed": [
        "Error en cálculo de punto de equilibrio"
      ]
    },
    // ... versiones anteriores
  }
}
```

**IMPORTANTE**: También actualiza `version.en.json` con el mismo contenido en inglés.

#### 6. Actualiza el array de versiones en `VersionBadge.tsx`

**Archivo**: `web/components/ui/VersionBadge.tsx`

```typescript
// Línea ~29
const releases = ['v0_3_0', 'v0_2_0', 'v0_1_0']; // ← AGREGAR NUEVA
const releaseVersions = ['0.3.0', '0.2.0', '0.1.0']; // ← AGREGAR NUEVA
```

#### 7. Commit y Push

```bash
git add .
git commit -m "chore: bump version to 0.3.0"
git push
```

#### 8. (Opcional) Crear GitHub Release

Si usas GitHub:
1. Ve a: https://github.com/tu-usuario/laralis/releases
2. Click "Draft a new release"
3. Tag: `v0.3.0`
4. Title: `v0.3.0 - Mejoras en Formularios`
5. Description: Copia del CHANGELOG
6. Publish

---

## 5️⃣ EJEMPLO COMPLETO

### Cambio: "Agregué botón 'Guardar y agregar otro' en tratamientos"

#### Paso 1: Decidir versión
- Es una **nueva funcionalidad** → MINOR
- De `0.2.0` → `0.3.0`

#### Paso 2: `web/package.json`
```json
{
  "version": "0.3.0"  // ← Cambié de 0.2.0 a 0.3.0
}
```

#### Paso 3: `web/.env.local`
```bash
NEXT_PUBLIC_APP_VERSION=0.3.0
```

#### Paso 4: `CHANGELOG.md`
```markdown
## [0.3.0] - 2025-12-15

### ✨ Agregado
- Botón "Guardar y agregar otro" en formulario de tratamientos
- Permite crear múltiples tratamientos consecutivos sin salir del formulario
- Mejora la velocidad de entrada de datos en 40%

### 🔧 Mejorado
- Performance del formulario de tratamientos
```

#### Paso 5: `web/messages/version.es.json`
```json
{
  "releases": {
    "v0_3_0": {
      "date": "2025-12-15",
      "title": "Mejoras en Entrada de Datos",
      "added": [
        "Botón 'Guardar y agregar otro' en formulario de tratamientos",
        "Permite crear múltiples tratamientos sin salir del formulario",
        "Mejora la velocidad de entrada de datos en 40%"
      ],
      "improved": [
        "Performance del formulario de tratamientos"
      ]
    }
  }
}
```

#### Paso 6: `web/components/ui/VersionBadge.tsx`
```typescript
const releases = ['v0_3_0', 'v0_2_0', 'v0_1_0'];
const releaseVersions = ['0.3.0', '0.2.0', '0.1.0'];
```

#### Paso 7: Commit
```bash
git add .
git commit -m "feat: add save and add another button in treatments

- New button in treatment form
- Improves data entry speed by 40%
- Bumps version to 0.3.0"
git push
```

---

## 6️⃣ COMUNICACIÓN POR WHATSAPP (Alternativa)

Si quieres seguir usando WhatsApp ADEMÁS del sistema in-app:

### Template Profesional

```
🎉 *Laralis v0.3.0 disponible*

Hola! Acabo de lanzar una nueva versión con mejoras:

✨ *Nuevo*
• Botón "Guardar y agregar otro" en tratamientos
• Ahora puedes crear múltiples tratamientos más rápido

🔧 *Mejorado*
• Performance del formulario (40% más rápido)

Para ver todos los cambios, haz click en la versión (esquina inferior izquierda del sidebar).

Cualquier duda, me avisas!
```

### Cuándo enviar

- Solo para versiones **MINOR** o **MAJOR** (no PATCH)
- Máximo 1 vez por semana
- Mejor los viernes en la tarde

---

## 7️⃣ BUENAS PRÁCTICAS

### ✅ DO (Hacer)

- Versionar cada cambio, por pequeño que sea
- Usar CHANGELOG para registrar TODO
- Escribir en lenguaje simple (no técnico)
- Explicar BENEFICIO al usuario, no el código
- Mantener consistencia en formato

### ❌ DON'T (No hacer)

- ❌ Saltarse versiones (0.1.0 → 0.3.0)
- ❌ Usar lenguaje técnico en CHANGELOG
  - Mal: "Refactored RLS policies in Supabase"
  - Bien: "Mejorada la seguridad del sistema"
- ❌ Olvidar actualizar `.env.local`
- ❌ Cambiar versión sin actualizar CHANGELOG

---

## 8️⃣ HERRAMIENTAS ÚTILES

### Generar CHANGELOG automático (opcional)

```bash
# Instalar herramienta global
npm install -g conventional-changelog-cli

# Generar desde commits
conventional-changelog -p angular -i CHANGELOG.md -s
```

**Requiere**: Commits en formato convencional:
```bash
git commit -m "feat: add save and another button"
git commit -m "fix: repair break-even calculation"
```

### Bump version automático

```bash
# Instalar en el proyecto
npm install --save-dev standard-version

# Usar
npm run release  # Auto bump + CHANGELOG + git tag
```

---

## 9️⃣ CHECKLIST RÁPIDO

Antes de lanzar una nueva versión:

- [ ] Decidí el tipo de versión (MAJOR/MINOR/PATCH)
- [ ] Actualicé `web/package.json`
- [ ] Actualicé `web/.env.local`
- [ ] Actualicé `CHANGELOG.md`
- [ ] Actualicé `web/messages/version.es.json`
- [ ] Actualicé `web/messages/version.en.json`
- [ ] Actualicé array en `VersionBadge.tsx`
- [ ] Probé que el modal de "Qué hay de nuevo" funciona
- [ ] Hice commit y push
- [ ] (Opcional) Envié mensaje a usuarios

---

## 🔟 FAQ

### ¿Cada cuánto versiono?

- **Ideal**: Cada feature o bug fix
- **Mínimo**: Al final de cada semana de trabajo
- **Releases**: Cada 2-4 semanas

### ¿Qué pongo en "Sin publicar"?

Cambios que ya hiciste en tu código pero no has lanzado aún.

### ¿Puedo editar versiones viejas del CHANGELOG?

Sí, si descubres que olvidaste mencionar algo. Agrega una nota al final:
```markdown
## [0.2.0] - 2025-10-18

### ✨ Agregado
- Dark Mode
- Wizard de Setup
- *Actualización 2025-12-05*: También se agregó cleanup automático
```

### ¿Cómo manejo hotfixes urgentes?

```bash
# Si estás en 0.3.0 y descubres un bug crítico:
0.3.0 → 0.3.1  # PATCH inmediato

# CHANGELOG
## [0.3.1] - 2025-12-15 (Hotfix)

### 🐛 Corregido
- [CRÍTICO] Error que impedía guardar tratamientos
```

### ¿Debo versionar cambios internos (refactoring)?

- Si **no afecta** al usuario → NO cambies versión
- Si **mejora performance** → PATCH o MINOR
- Si **agrega feature invisible** (ej: analytics) → MINOR

---

## 📚 Referencias

- [Keep a Changelog](https://keepachangelog.com/es/) - Formato estándar
- [Semantic Versioning](https://semver.org/lang/es/) - Reglas de versionado
- [Conventional Commits](https://www.conventionalcommits.org/es/) - Formato de commits

---

## 🎓 Resumen para Principiantes

1. **Cada cambio** = Nueva versión
2. **Bugs** = +0.0.1 (PATCH)
3. **Features** = +0.1.0 (MINOR)
4. **Breaking** = +1.0.0 (MAJOR)
5. **Actualizar 4 archivos**: package.json, .env.local, CHANGELOG.md, version.es.json
6. **Los usuarios lo ven**: Click en versión (sidebar)

---

**Última actualización**: 2025-12-05
**Autor**: Sistema de Versionado Laralis
