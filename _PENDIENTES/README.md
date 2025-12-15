# Requisitos, Errores y Tareas Pendientes

Este directorio guarda transcripciones y notas del usuario sobre problemas detectados, requisitos nuevos y mejoras pendientes.

## Estructura

```
_PENDIENTES/
├── README.md (este archivo)
└── YYYY-MM-DD-<tema>.md (transcripciones por fecha)
```

## Archivos

| Fecha | Archivo | Tema | Issues | Estado |
|-------|---------|------|--------|--------|
| 2025-12-09 | `2025-12-09-dashboard-issues.md` | Dashboard Mega Refactor | 23 | ✅ 23/23 Completado |
| 2025-12-15 | `2025-12-15-settings-filters-ux.md` | Settings, Filtros, UX, Notificaciones | 19 | 🔲 Pendiente |

## Resumen Actual

- **Total transcripciones**: 2
- **Issues identificadas**: 42
- **Completadas**: 24 (57%)
- **Pendientes**: 18 (43%)

## Como usar

1. **Agregar nueva transcripcion**: Crear archivo `YYYY-MM-DD-<tema-corto>.md`
2. **Marcar como resuelto**: Actualizar estado en esta tabla
3. **Desglosar en issues**: Cuando se trabaje, crear issues en `tasks/issues/`

## Temas Pendientes (2025-12-15)

### P0 - Criticos
- [ ] Punto de equilibrio: "23 dias restantes" incorrecto
- [ ] Telefono no aparece en Cuenta/Perfil
- [ ] Traducciones faltantes (settings.reset.description)

### P1 - Importantes
- [x] ~~Filtros del Dashboard desactualizados~~ (SmartFilters implementado)
- [ ] Renombrar "Insights" a "Dashboard"
- [ ] Analisis de contribucion en Dashboard (90 dias)
- [ ] Punto de equilibrio: UX confusa
- [ ] Configuracion duplicada (Notificaciones en 2 lugares)
- [ ] Navegacion duplicada en sidebar
- [ ] Sin navegacion "Ir atras" en Configuracion

### P2 - Mejoras
- [ ] Cuenta/Perfil: UI con tarjeta separada "Editar"
- [ ] Zona horaria: ¿por clinica o por cuenta?
- [ ] Notificaciones email/SMS/push sin probar
- [ ] Cambio de contraseña y 2FA sin verificar
- [ ] Rentabilidad: ganancia real vs comisiones doctores

## Notas

- El prefijo `_` hace que esta carpeta aparezca arriba en el explorador
- Cada transcripcion se guarda tal cual la dice el usuario
- Se puede extraer tasks especificos despues para trabajar
- **REGLA**: Siempre buscar patrones existentes antes de crear algo nuevo

---

Ultima actualizacion: 2025-12-15
