Perfecto, Isma. Metí el “look and feel” tipo Apple en el PR. Minimal, aireado, serio y moderno. Con tokens, spacing, sombras suaves y microcopy limpio. Copia y pega esto en Cursor.

```
PR TITLE
feat: Apple-style clean UI shell, i18n EN/ES, calc engine with tests, multi-tenant shell, sources/referrals groundwork

CONTEXT
La app debe sentirse premium y sobria. Interfaz limpia, moderna y con mucho aire. Estilo Apple sin adornos innecesarios. Tipografía clara, jerarquías correctas, foco en contenido y datos. Inglés por defecto con opción de español desde un selector.

BUSINESS FOUNDATIONS (FROM MVP DOCS)
El sistema se sostiene en una cadena de dependencias inmutable para cálculos y precios:

```
Depreciación → Costos Fijos → Costos por Tiempo → Punto de Equilibrio
                                ↓
                            Insumos → Servicios → Tarifas
                                         ↓
                                     Tratamientos
```

Además, la arquitectura es multi-tenant: un Workspace (marca) agrupa múltiples Clínicas (ubicaciones) con métricas agregadas y configuración heredable. El motor financiero calcula costo real por minuto, manteniendo snapshots históricos para no reescribir el pasado.

STACK AND CONSTRAINTS
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Postgres con supabase-js
- Zod + React Hook Form
- Vitest para unit tests
- i18n con next-intl. Default en y alterno es
- Dinero en centavos
- Iconos lucide-react
- Animaciones sutiles con framer-motion

SCOPE OF THIS PR
1) Bootstrap del proyecto y theme base Apple-like
2) Cliente Supabase y env vars (sin exponer service role en cliente)
3) Librería de cálculos con tests alineados a la hoja (depreciación, costos fijos, tiempo, punto de equilibrio, tarifa, redondeo múltiplo)
4) i18n EN por defecto y ES alterno con selector
5) Shell de navegación y páginas mínimas de Setup + estructura multi-tenant (Workspace/Clinics) a nivel UI
6) Groundwork de "Patient Sources & Referrals" (modelo y endpoints base o placeholders de UI, sin lógica avanzada)
7) README con guías de estilo, money en centavos, y gobernanza de tareas/devlog

OUT OF SCOPE
- Auth
- Prisma o Drizzle
- CRUD real contra DB
- Dashboard con gráficas
- Lógica avanzada de tracking de campañas, ROI y referidos multinivel

FILES TO ADD OR MODIFY
- package.json scripts dev build start lint test
- .env.example con SUPABASE_URL, SUPABASE_ANON_KEY
- README.md con guía de estilo y cómo correr
- tailwind.config.ts con theme extend y tokens
- postcss.config.mjs
- app/globals.css con CSS vars del design system
- app/layout.tsx con NextIntlClientProvider y shell
- app/page.tsx bienvenida y links
- app/(setup)/time/page.tsx form placeholder con RHF
- app/(setup)/fixed-costs/page.tsx tabla placeholder
- lib/supabase.ts
- lib/money.ts
- lib/calc/tiempo.ts, depreciacion.ts, variable.ts, tarifa.ts, puntoEquilibrio.ts
- lib/calc/__tests__/*.test.ts
- i18n/i18n.ts e i18n/request.ts
- messages/en.json y messages/es.json
- components/LanguageSwitcher.tsx
- components/ui/*
  - PageHeader.tsx
  - Card.tsx  wrapper sobre shadcn Card con variantes
  - EmptyState.tsx
  - FormField.tsx  label helper text error
  - DataTable.tsx  tabla base con TanStack Table
  - Skeleton.tsx
  - (Opcional) Empty shell para Workspaces/Clinics y Sources en navegación

DESIGN SYSTEM

1) Principios
- Minimalismo funcional. Un solo color acento y grises neutros
- Aire generoso. Espaciado 8 12 16 24 32 48 72
- Bordes redondeados 16px en tarjetas y controles importantes
- Sombras suaves para profundidad, nunca duras
- Microcopy claro y corto en inglés por defecto
- Estados vacíos amables y útiles con call to action

2) Tipografía
- Stack del sistema para sentir nativo
  font-sans: ui-sans-serif, system-ui, -apple-system, "SF Pro", Inter, "Segoe UI", Roboto
- Títulos semibold, cuerpo regular. Tamaños base 14 16 18 20 24 28 32

3) Colores
- Neutros basados en zinc de Tailwind
- Acento brand en azul calmado
  brand 500 para acciones primarias
- Estados con verdes y rojos suaves

4) Motion
- Duración 150ms a 220ms
- Curva ease-out para entradas y ease-in para salidas
- Animaciones sutiles en hover y aparición de tarjetas

5) Accesibilidad
- Contraste mínimo AA
- Focus visible en todos los controles
- Targets táctiles de 44px mínimo
- Soporte de teclado en formularios y tabla

TAILWIND THEME TOKENS

Actualizar tailwind.config.ts con extend
- borderRadius  md 12px  lg 16px  xl 20px  2xl 24px
- boxShadow sm 0 1px 2px rgba(0,0,0,0.06)  md 0 4px 12px rgba(0,0,0,0.08)
- colors
  brand 50 600
  neutral mapea a zinc
- spacing escala 2 3 4 6 8 12 16 24 32 48 72

globals.css
- Definir CSS vars
  --radius 16px
  --card-bg 255 255 255
  --surface 248 250 252
  --text-1 17 24 39
  --text-2 75 85 99
- Soporte dark con prefers-color-scheme pero dejarlo off por ahora

SHELL Y LAYOUT

app/layout.tsx
- Header pegado arriba con LanguageSwitcher a la derecha
- Sidebar de 280px con navegación
- Contenido centrado con max-w 1280 y padding 24 32
- PageHeader con título y descripción breve
- Contenedor Card para cada sección con padding 24 y radius 16
- Agrupar navegación por áreas: Setup (Depreciación, Costos fijos, Tiempo, Punto de equilibrio), Inventario (Insumos), Servicios (Recetas/variables), Precios (Tarifas), Operación (Pacientes, Tratamientos), Reportes

COMPONENTS UX

PageHeader
- title string
- description string opcional
- actions ReactNode opcional

Card
- variant default subtle
- Header Content Footer

EmptyState
- icon
- title
- description
- action

FormField
- label
- description
- error
- children como input control

DataTable
- Encabezado claro, zebra stripes muy sutiles
- Toolbar con Search y acciones
- Paginación inferior con recuento

Skeleton
- Shimmers para carga de tablas y tarjetas

COPY ENGLISH DEFAULT

messages/en.json
{
  "nav.dashboard": "Dashboard",
  "nav.setup": "Setup",
  "nav.setup.time": "Working time",
  "nav.setup.fixed": "Fixed costs",
  "nav.setup.depreciation": "Depreciation",
  "nav.setup.breakEven": "Break-even",
  "nav.inventory": "Inventory",
  "nav.inventory.supplies": "Supplies",
  "nav.services": "Services",
  "nav.pricing": "Pricing",
  "nav.patients": "Patients",
  "nav.treatments": "Treatments",
  "nav.workspaces": "Workspaces",
  "nav.clinics": "Clinics",
  "ui.save": "Save",
  "ui.cancel": "Cancel",
  "ui.language": "Language",
  "ui.english": "English",
  "ui.spanish": "Spanish",
  "ui.search": "Search",
  "empty.title": "Nothing here yet",
  "empty.desc": "Start by adding your first item",
  "setup.time.title": "Working time settings",
  "setup.fixed.title": "Fixed costs",
  "sources.title": "Patient sources",
  "sources.referrals": "Referrals"
}

messages/es.json
{
  "nav.dashboard": "Tablero",
  "nav.setup": "Configuración",
  "nav.setup.time": "Tiempo laboral",
  "nav.setup.fixed": "Costos fijos",
  "nav.setup.depreciation": "Depreciación",
  "nav.setup.breakEven": "Punto de equilibrio",
  "nav.inventory": "Inventario",
  "nav.inventory.supplies": "Insumos",
  "nav.services": "Servicios",
  "nav.pricing": "Precios",
  "nav.patients": "Pacientes",
  "nav.treatments": "Tratamientos",
  "nav.workspaces": "Espacios de trabajo",
  "nav.clinics": "Clínicas",
  "ui.save": "Guardar",
  "ui.cancel": "Cancelar",
  "ui.language": "Idioma",
  "ui.english": "Inglés",
  "ui.spanish": "Español",
  "ui.search": "Buscar",
  "empty.title": "Aún no hay nada",
  "empty.desc": "Comienza agregando tu primer elemento",
  "setup.time.title": "Ajustes de tiempo laboral",
  "setup.fixed.title": "Costos fijos",
  "sources.title": "Fuentes de pacientes",
  "sources.referrals": "Referidos"
}

INTERACCIONES Y DETALLES UI

- Inputs con placeholders sobrios y helper text corto
- Botón primario con brand 600 en hover y 500 de base
- Estados de error con borde y texto sutil, nada chillón
- Tablas con filas de 56px de alto y tipografía 14
- Formularios con grid de 12 columnas, gap 24
- Empty states con icono lineal y un CTA claro
- Loader skeleton visible en 300ms para listas

CALC ENGINE TESTS

Mantener los casos definidos previamente
- depreciacion.test.ts
- tiempo.test.ts
- variable.test.ts
- tarifa.test.ts
- puntoEquilibrio.test.ts
- redondeoMultiplo.test.ts

DATA MODEL NOTES (SUMMARIZED)
- Multi-tenant: workspaces → clinics → operational data (patients, treatments, services)
- Categorías editables: insumos, servicios, costos fijos, fuentes/vías
- Snapshots en tratamientos: fixedPerMinuteCents, minutes, variableCostCents, marginPct, priceCents, tariffVersion
- RLS activo y claves desde variables de entorno (no exponer service role en cliente)

ACCEPTANCE CRITERIA

- npm i y npm run dev sin errores
- npm test verde en todos los módulos de cálculo (lib/calc/__tests__)
- Todas las cantidades monetarias en centavos enteros, usando helpers de lib/money.ts
- La app arranca en inglés y se puede alternar a español; todas las cadenas en messages/en.json y messages/es.json
- WCAG AA: contraste, focus visible, targets ≥ 44px, no depender solo de color
- Validación con Zod en formularios y mensajes de error amigables
- Layout con max-w 1280, sidebar 280, padding horizontal 32 en desktop
- PageHeader presente en páginas de Setup y navegación agrupada por áreas
- EmptyState y Skeleton visibles donde aplique
- Sombras suaves y radios como en tokens, sin sombras duras
- Sin nuevas dependencias no aprobadas
- Sin cambios fuera del alcance indicado

TASKS AND DEVLOG
- Antes de abrir PR: crear/actualizar entradas en `tasks/` (active/backlog) con ids y checklist
- En el PR y tras merge: documentar en `docs/devlog/YYYY-MM-DD-<slug>.md` con contexto, problema, root cause, cambios, archivos tocados, before/after, cómo probar, riesgos y follow-ups

DELIVERY

- Entregar diff completo de archivos nuevos o modificados
- Al final, un resumen de qué se agregó y cómo seguir
- No proponer features fuera de alcance

HOW TO TEST (MANUAL)
1) Instalar dependencias: `npm i`
2) Ejecutar unit tests de cálculo: `npm test`
3) Levantar entorno: `npm run dev`
4) Verificar navegación y i18n (EN ↔ ES)
5) Revisar accesibilidad básica (focus visible, contraste) y tamaño de targets
6) Revisar que el dinero se muestre formateado con Intl y se maneje en centavos internamente

Now create the complete patch following these instructions
```
