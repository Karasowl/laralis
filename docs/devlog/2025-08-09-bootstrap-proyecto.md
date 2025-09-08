# Bootstrap del Proyecto Laralis - 2025-08-09

**Relacionado con**: TASK-20250809-bootstrap-app-shell  
**PR**: TBD  
**Autor**: Claude + Isma

---

## Contexto

Iniciamos desde cero el desarrollo de una aplicación web para gestión de consultorio dental. Necesitábamos establecer los fundamentos técnicos, arquitectura y herramientas para un desarrollo ágil y mantenible.

## Problema

Partiendo de cero, necesitábamos:
1. Stack tecnológico moderno y eficiente
2. Sistema de internacionalización robusto
3. Motor de cálculos confiable para costeo dental  
4. Interfaz limpia y profesional
5. Flujo de trabajo estructurado

## Causa Raíz

El proyecto Laralis no existía. Requeríamos una base sólida que permitiera desarrollo rápido pero mantenible, considerando que manejará cálculos financieros críticos y debe soportar múltiples idiomas desde el inicio.

## Qué Cambió

### 1. Arquitectura del Proyecto
- **Estructura**: Separamos la app web en `web/` manteniendo configs y docs en raíz
- **Stack**: Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- **Testing**: Vitest para tests unitarios del motor de cálculos

### 2. Sistema de Cálculos
Implementamos motor de cálculo puro basado en la hoja Excel:
- **Tiempo**: Cálculo de costo fijo por minuto
- **Depreciación**: Depreciación lineal de activos  
- **Variable**: Cálculo de costos por insumos
- **Tarifas**: Cálculo de precios con margen y redondeo
- **Punto Equilibrio**: Análisis de break-even

### 3. Sistema Monetario
- Todo en centavos enteros para evitar errores de punto flotante
- Utilidades de conversión y formateo por locale
- Redondeo configurable por escalones

### 4. Interfaz Estilo Apple
- Sistema de componentes limpio y aireado
- Espaciado generoso, bordes redondeados (16px)
- Componentes wrapper: PageHeader, Card, EmptyState, FormField, DataTable
- Tipografía del sistema con SF Pro como preferencia

### 5. Internacionalización
- next-intl para manejo de traducciones
- Inglés por defecto, español como alternativa
- Números y moneda formateados por locale
- Conmutador de idioma persistente por cookies

### 6. Metodología de Trabajo
- Sistema de tareas tipo Taskmaster en `tasks/`
- Devlog tutorial en `docs/devlog/`
- Reglas de Cursor para mantener consistencia

## Archivos Tocados

### Estructura Principal
```
web/
├── app/
│   ├── layout.tsx - Layout principal con header y nav
│   ├── page.tsx - Landing page con quick links
│   └── (setup)/
│       ├── time/page.tsx - Configuración de tiempo
│       └── fixed-costs/page.tsx - Costos fijos
├── components/
│   ├── LanguageSwitcher.tsx - Conmutador de idioma
│   └── ui/ - Sistema de componentes base
├── lib/
│   ├── money.ts - Utilidades monetarias
│   ├── supabase.ts - Cliente de base de datos
│   ├── utils.ts - Utilidades generales
│   └── calc/ - Motor de cálculos con 5 módulos
├── i18n/ - Configuración de internacionalización
├── messages/ - Archivos de traducción EN/ES
└── __tests__/ - 99 tests unitarios del motor
```

### Configuración
- `package.json` - Dependencias y scripts
- `tailwind.config.ts` - Temas y tokens de design
- `vitest.config.ts` - Configuración de testing
- `.env.example` - Variables de entorno

### Documentación y Procesos  
- `tasks/` - Sistema completo de gestión de tareas
- `docs/devlog/` - Índice y primera entrada
- `docs/reference/` - Ubicación para la hoja Excel de referencia

## Antes vs Después

### Antes
- Directorio vacío excepto por `CLAUDE.md`, `.cursor/` y `tasks/`
- Sin estructura de proyecto definida
- Sin herramientas de desarrollo

### Después  
- Aplicación Next.js funcional en `web/`
- 99 tests unitarios pasando para motor de cálculos
- Interfaz limpia con componentes reutilizables
- Sistema i18n funcionando (EN ↔ ES)
- Páginas de configuración con formularios funcionales
- Sistema de tareas y documentación estructurado

## Cómo Probar

### 1. Instalación y Tests
```bash
cd web
npm install
npm test
```
Debería mostrar: `99 passed (99)`

### 2. Desarrollo  
```bash
npm run dev
```
Visita: http://localhost:3000

### 3. Verificar Funcionalidades
- **Cambio de idioma**: Click en selector de idioma (superior derecha)
- **Calculadora tiempo**: `/setup/time` - Ingresar valores y calcular
- **Costos fijos**: `/setup/fixed-costs` - Ver tabla ejemplo
- **Responsividad**: Probar en desktop, tablet y móvil

### 4. Tests de Cálculos
Los números de ejemplo coinciden con la hoja Excel de referencia:
- Depreciación: 6,762,000 centavos / 36 meses = 187,833 centavos/mes  
- Costo por tiempo: 20 días × 7 hrs × 80% = 6,720 min efectivos
- Costo fijo: 1,854,533 centavos / 6,720 min = 276 centavos/min

## Riesgos y Rollback

### Riesgos Identificados
1. **Dependencias nuevas**: Agregamos muchas librerías de una vez
2. **Estructura compleja**: Separar web/ de raíz puede confundir  
3. **Tests unitarios**: 99 tests pueden volverse costosos de mantener
4. **i18n**: Overhead de traducir todo desde inicio

### Plan de Rollback
- **Total**: `git revert` del commit completo
- **Parcial**: Cada subsistema está modularizado y se puede desabilitar
- **Dependencias**: `package.json` tiene solo las esenciales por módulo

### Mitigaciones
- Todos los tests pasan antes de commit
- Componentes UI tienen fallbacks básicos
- Sistema monetario tiene validaciones exhaustivas
- i18n tiene claves por defecto en inglés

## Siguientes Pasos

### Inmediato (Próximo PR)
- [ ] TASK-20250809-supabase-schema - Crear esquema de BD completo
- [ ] Configurar variables de entorno para desarrollo
- [ ] Crear primera migración de Supabase  

### Corto Plazo
- [ ] TASK-20250809-crud-operations - Operaciones CRUD básicas
- [ ] TASK-20250809-patient-management - Gestión de pacientes
- [ ] Formularios de agregar/editar para costos fijos

### Medio Plazo  
- [ ] Dashboard de reportes financieros
- [ ] Sistema de autenticación
- [ ] Exportación de datos

## Métricas

- **Líneas de código**: ~2,500 (sin tests)
- **Archivos creados**: 52
- **Tests unitarios**: 99/99 ✅
- **Cobertura estimada**: >90% del motor de cálculos
- **Tiempo desarrollo**: ~6 horas
- **Bundle size**: <170KB (objetivo cumplido)

## Lecciones Aprendidas

### ✅ Qué funcionó bien
- **Tests primero**: Escribir tests antes que UI aceleró desarrollo
- **Separación web/**: Mantener configs en raíz simplifica tooling
- **Componentes base**: shadcn/ui como foundation nos dio velocidad
- **Motor puro**: Funciones puras facilitan testing y debugging

### ⚠️ Áreas de mejora  
- **Mejor tipado**: TypeScript podría ser más estricto en algunas interfaces
- **Consistencia**: Algunos componentes usan patrones diferentes
- **Performance**: No optimizamos renders ni bundle splitting aún

### 📚 Decisiones Técnicas Importantes
1. **Centavos enteros**: Evita problemas de precision en flotantes
2. **Server Components por defecto**: Mejor SEO y performance  
3. **next-intl server-side**: Mejor para SSR que client-only
4. **Vitest sobre Jest**: Más rápido y mejor DX para testing
5. **Schema manual**: Evitamos ORMs para control total sobre queries