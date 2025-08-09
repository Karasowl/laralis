Perfecto, Isma. Metí el “look and feel” tipo Apple en el PR. Minimal, aireado, serio y moderno. Con tokens, spacing, sombras suaves y microcopy limpio. Copia y pega esto en Cursor.

```
PR TITLE
feat: Apple-style clean UI shell, i18n EN default + ES toggle, calc engine, Supabase setup

CONTEXT
La app debe sentirse premium y sobria. Interfaz limpia, moderna y con mucho aire. Estilo Apple sin adornos innecesarios. Tipografía clara, jerarquías correctas, foco en contenido y datos. Inglés por defecto con opción de español desde un selector.

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
2) Cliente Supabase y env vars
3) Librería de cálculos con tests alineados a la hoja
4) i18n básico con switch EN ES
5) Shell de navegación y páginas mínimas de Setup
6) README con guías de estilo y uso

OUT OF SCOPE
- Auth
- Prisma o Drizzle
- CRUD real contra DB
- Dashboard con gráficas

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
  "ui.save": "Save",
  "ui.cancel": "Cancel",
  "ui.language": "Language",
  "ui.english": "English",
  "ui.spanish": "Spanish",
  "ui.search": "Search",
  "empty.title": "Nothing here yet",
  "empty.desc": "Start by adding your first item",
  "setup.time.title": "Working time settings",
  "setup.fixed.title": "Fixed costs"
}

messages/es.json
{
  "nav.dashboard": "Tablero",
  "nav.setup": "Configuración",
  "nav.setup.time": "Tiempo laboral",
  "nav.setup.fixed": "Costos fijos",
  "ui.save": "Guardar",
  "ui.cancel": "Cancelar",
  "ui.language": "Idioma",
  "ui.english": "Inglés",
  "ui.spanish": "Español",
  "ui.search": "Buscar",
  "empty.title": "Aún no hay nada",
  "empty.desc": "Comienza agregando tu primer elemento",
  "setup.time.title": "Ajustes de tiempo laboral",
  "setup.fixed.title": "Costos fijos"
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

ACCEPTANCE CRITERIA

- npm i y npm run dev sin errores
- npm test verde en todos los módulos de cálculo
- La app arranca en inglés y se puede alternar a español
- Lighthouse Performance y Best Practices por encima de 90 en la shell
- Focus states visibles en todos los controles interactivos
- Layout con max-w 1280, sidebar 280, padding horizontal 32 en desktop
- PageHeader presente en pages de Setup
- EmptyState y Skeleton visibles donde aplique
- Sombras suaves y radios como en tokens, sin sombras duras

DELIVERY

- Entregar diff completo de archivos nuevos o modificados
- Al final, un resumen de qué se agregó y cómo seguir
- No proponer features fuera de alcance

Now create the complete patch following these instructions
```
