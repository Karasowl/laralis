# Tasks System - Taskmaster Style

Este directorio contiene el sistema de gestión de tareas tipo Taskmaster para el proyecto Laralis.

## Estructura de Archivos

- `README.md` - Este archivo con documentación del sistema
- `template.md` - Plantilla para crear nuevas tareas
- `backlog.md` - Tareas pendientes por priorizar
- `active.md` - Tareas actualmente en progreso
- `done.md` - Tareas completadas
- `week-YYYY-WW.md` - Resúmenes semanales (opcional)
- `YYYY-MM-DD-<slug>.md` - Archivos individuales para tareas grandes

## Formato de Tareas

Cada tarea debe tener el siguiente front matter YAML:

```yaml
---
id: TASK-YYYYMMDD-<slug>
title: Título imperativo de la tarea
status: backlog|active|blocked|done
priority: P1|P2|P3
estimate: XS|S|M|L
area: calc|ui|data|infra|docs|i18n|testing
parent: null (o ID de tarea padre)
links: []
---
```

Seguido de una lista de criterios de aceptación:

- [ ] Criterio de aceptación 1
- [ ] Criterio de aceptación 2

## Áreas de Trabajo

- **calc**: Motor de cálculos y funciones de negocio
- **ui**: Componentes de interfaz y páginas
- **data**: Base de datos, modelos y APIs
- **infra**: Configuración, despliegue y herramientas
- **docs**: Documentación y devlogs
- **i18n**: Internacionalización y traducciones
- **testing**: Tests unitarios e integración

## Prioridades

- **P1**: Crítico - Bloquea otras tareas o funcionalidad core
- **P2**: Alto - Importante para el milestone actual
- **P3**: Medio - Bueno tener, no urgente

## Estimaciones

- **XS**: < 1 hora
- **S**: 1-4 horas
- **M**: 1 día
- **L**: 2-5 días (debe dividirse en subtareas)

## Flujo de Trabajo

1. Las tareas nuevas se agregan al `backlog.md`
2. Las tareas se mueven a `active.md` cuando se comienza a trabajar
3. Las tareas completadas se mueven a `done.md`
4. Las tareas bloqueadas se marcan con status `blocked`

## Reglas

- Máximo 3 tareas activas simultáneamente
- Tareas L deben dividirse en subtareas S o M
- Cada PR debe referenciar al menos una tarea
- Actualizar tasks/ en cada PR antes de merge