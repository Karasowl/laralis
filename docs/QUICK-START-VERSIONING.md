# ⚡ Inicio Rápido: Versionado de Laralis

## 🎯 Solo necesitas saber esto

### Cuando hagas cambios, usa estos comandos:

```bash
cd web

# Bug fix (0.2.0 → 0.2.1)
npm run version:patch

# Nueva feature (0.2.0 → 0.3.0)
npm run version:minor

# Breaking change (0.2.0 → 1.0.0)
npm run version:major
```

---

## 📝 Luego actualiza 4 archivos

### 1. `web/.env.local`
```bash
NEXT_PUBLIC_APP_VERSION=0.3.0  # ← Nueva versión
```

### 2. `CHANGELOG.md`
```markdown
## [0.3.0] - 2025-12-15

### ✨ Agregado
- Lo que agregaste

### 🐛 Corregido
- Lo que arreglaste
```

### 3. `web/messages/version.es.json` (y version.en.json)
```json
{
  "releases": {
    "v0_3_0": {  // ← Usa _ en vez de .
      "date": "2025-12-15",
      "title": "Título del Release",
      "added": ["Lo que agregaste"],
      "fixed": ["Lo que arreglaste"]
    }
  }
}
```

### 4. `web/components/ui/VersionBadge.tsx` (línea ~29)
```typescript
const releases = ['v0_3_0', 'v0_2_0', ...];  // ← Agregar nueva
const releaseVersions = ['0.3.0', '0.2.0', ...];
```

---

## ✅ Commit y listo

```bash
git add .
git commit -m "chore: bump version to 0.3.0"
git push
```

---

## 👀 ¿Cómo lo ven tus usuarios?

1. Entran a la app
2. Click en "v0.2.0" (esquina inferior izquierda del sidebar)
3. Ven modal bonito con todas las novedades

---

## 📚 ¿Necesitas más ayuda?

- **Guía completa**: [VERSIONING-AND-RELEASE-NOTES.md](./VERSIONING-AND-RELEASE-NOTES.md)
- **Ejemplos**: [CHANGELOG-EXAMPLES.md](./CHANGELOG-EXAMPLES.md)
- **Referencia rápida**: [VERSIONING-QUICK-GUIDE.md](./VERSIONING-QUICK-GUIDE.md)
- **Resumen completo**: [VERSION-SYSTEM-SUMMARY.md](./VERSION-SYSTEM-SUMMARY.md)

---

## 🚨 Checklist Mínimo

- [ ] `npm run version:X`
- [ ] `.env.local` actualizado
- [ ] `CHANGELOG.md` actualizado
- [ ] `version.es.json` y `version.en.json` actualizados
- [ ] `VersionBadge.tsx` actualizado
- [ ] Commit y push

---

**Eso es todo.** Sistema profesional de versionado en 5 minutos. 🎉
