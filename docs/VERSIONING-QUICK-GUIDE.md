# 🚀 Guía Rápida de Versionado

## Comandos Rápidos

```bash
# En la carpeta web/
cd web

# Bug fix (0.2.0 → 0.2.1)
npm run version:patch

# Nueva feature (0.2.0 → 0.3.0)
npm run version:minor

# Cambio grande (0.2.0 → 1.0.0)
npm run version:major
```

---

## Flujo Completo en 5 Pasos

### 1. Incrementar Versión

```bash
cd web
npm run version:minor  # Ejemplo: nueva feature
```

### 2. Actualizar `.env.local`

```bash
# Editar: web/.env.local
NEXT_PUBLIC_APP_VERSION=0.3.0  # ← Nueva versión
```

### 3. Actualizar `CHANGELOG.md`

```markdown
## [0.3.0] - 2025-12-15

### ✨ Agregado
- Botón "Guardar y agregar otro" en tratamientos

### 🐛 Corregido
- Error en cálculo de punto de equilibrio
```

### 4. Actualizar Traducciones

**Archivo**: `web/messages/version.es.json`

```json
{
  "releases": {
    "v0_3_0": {  // ← USAR _ EN VEZ DE .
      "date": "2025-12-15",
      "title": "Mejoras en Formularios",
      "added": [
        "Botón 'Guardar y agregar otro' en tratamientos"
      ],
      "fixed": [
        "Error en cálculo de punto de equilibrio"
      ]
    }
  }
}
```

**No olvides**: También actualizar `version.en.json` (mismo contenido en inglés)

### 5. Actualizar VersionBadge

**Archivo**: `web/components/ui/VersionBadge.tsx`

```typescript
// Línea ~29
const releases = ['v0_3_0', 'v0_2_0', 'v0_1_0']; // ← Agregar nueva
const releaseVersions = ['0.3.0', '0.2.0', '0.1.0']; // ← Agregar nueva
```

---

## Reglas de Versionado

| Cambio | Comando | Ejemplo |
|--------|---------|---------|
| 🐛 Bug fix | `npm run version:patch` | 0.2.0 → 0.2.1 |
| ✨ Nueva feature | `npm run version:minor` | 0.2.0 → 0.3.0 |
| 💥 Breaking change | `npm run version:major` | 0.2.0 → 1.0.0 |

---

## Categorías del Changelog

```markdown
### ✨ Agregado        - Nuevas funcionalidades
### 🔧 Mejorado       - Mejoras a features existentes
### 🐛 Corregido      - Arreglos de bugs
### 🗑️ Eliminado     - Features removidas
### 🔒 Seguridad      - Parches de seguridad
### 🎨 UI/UX          - Cambios visuales
### ⚡ Performance    - Mejoras de rendimiento
```

---

## Checklist antes de Commit

- [ ] `npm run version:minor` (o patch/major)
- [ ] Actualizado `.env.local` con nueva versión
- [ ] Actualizado `CHANGELOG.md`
- [ ] Actualizado `version.es.json`
- [ ] Actualizado `version.en.json`
- [ ] Actualizado array en `VersionBadge.tsx`
- [ ] Probado que modal funciona (click en versión en sidebar)

---

## Ver Novedades en la App

1. Entrar a la aplicación
2. Click en la versión (esquina inferior izquierda del sidebar)
3. Ver modal de "Qué hay de nuevo"

---

## Comunicar a Usuarios (Opcional)

### WhatsApp Template

```
🎉 Laralis v0.3.0 disponible

✨ Nuevo
• Botón "Guardar y agregar otro" en tratamientos

🐛 Corregido
• Error en punto de equilibrio

Ver más: Click en versión (sidebar)
```

---

## Documentación Completa

Ver: [`docs/VERSIONING-AND-RELEASE-NOTES.md`](./VERSIONING-AND-RELEASE-NOTES.md)

---

**Última actualización**: 2025-12-05
