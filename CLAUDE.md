\# Project Memory — Dental App

Reference spreadsheet lives under docs/reference/Consultorio-PoDent.xlsx.
 The spreadsheet is reference for calculations, not a runtime dependency.

Iconography system documented at @docs/ICONOGRAPHY.md - Always use these icons consistently.

See @README.md for overview and @PR.md for PR prompts.

See @tasks/README.md, @tasks/active.md, @tasks/backlog.md for planning.

If present, link to devlog index: @docs/devlog/INDEX.md

**CRITICAL**: Read @docs/AI-KNOWLEDGE-GAPS.md for non-obvious system knowledge (multi-tenancy, fixed costs calculation, margin vs markup, etc.)



\## Language and i18n (CRITICAL - ZERO TOLERANCE)

\- Reply to the human in Spanish. Code, identifiers and comments in English.

\- **ALL visible UI strings MUST use next-intl**. ZERO hardcoded text allowed.

\- **BEFORE adding ANY text**: Check if translation key exists first, then add to BOTH `messages/en.json` AND `messages/es.json`.

\- **FORBIDDEN patterns** (will fail PR):
  - Hardcoded strings: `"Save"`, `"Cancel"`, `"Usuario"`, etc.
  - Hardcoded placeholders: `"mm/dd/yyyy"`, `"Enter text..."`, etc.
  - Fallback text without t(): `user?.name || "Usuario"` ❌
  - Required asterisks in keys: `t('field.name*')` ❌
  
\- **REQUIRED patterns**:
  - All text via t(): `t('common.save')` ✅
  - Fallbacks with t(): `user?.name || t('common.defaultUser')` ✅
  - Separate asterisks: `{t('field.name')}{required && <span>*</span>}` ✅
  - Date inputs: Use HTML5 type="date", no placeholder needed ✅

\- Use next-intl number and currency formatting for the active locale.

\- **Verification checklist**:
  1. Search for quotes in JSX: Any `"text"` or `'text'` should be t('key')
  2. Search for Spanish text: "Usuario", "Guardar", "Cancelar", etc.
  3. Search for English text: "Save", "Cancel", "Loading", etc.
  4. Check all placeholders use t()
  5. Verify both en.json and es.json have ALL keys



\## Stack boundaries

\- Next.js 14 App Router + TypeScript. Tailwind + shadcn/ui.

\- Supabase with `@supabase/supabase-js` only. No Prisma/Drizzle for now.

\- Forms with React Hook Form + Zod. Tests with Vitest.

\- Do not add new deps without explicit approval in the PR.



\## Money handling

\- Store money in integer cents only. Never floats.

\- Use helpers in `lib/money.ts`. Round only on explicit business rules.



\## Pricing Architecture (CRITICAL)

\- **NO TARIFFS TABLE**: The `tariffs` table is deprecated. DO NOT query or write to it.

\- **Services = Price Catalog**: The `services` table IS your price catalog with discount support built-in.

\- **Service pricing fields**:
  - `price_cents` (bigint) - Final price with discount already applied (single source of truth)
  - `discount_type` (varchar) - 'none', 'percentage', or 'fixed'
  - `discount_value` (numeric) - Discount amount (% or cents depending on type)
  - `discount_reason` (text) - Why discount was applied
  - `margin_pct` (numeric) - Target profit margin percentage
  - `variable_cost_cents` (bigint) - Material/supply costs
  - `fixed_cost_per_minute_cents` (bigint) - Time-based costs

\- **Price calculation flow**:
  1. Calculate base cost: `variable_cost + (fixed_cost_per_minute * est_minutes)`
  2. Apply margin: `base_cost * (1 + margin_pct/100)`
  3. Apply discount if configured: `price - discount_amount`
  4. Store final result in `price_cents` - this is what patients pay

\- **Historical pricing**: Treatments table stores snapshots. Query treatments, NOT tariffs, for price history.

\- **AI assistant queries**: When asked about prices, query `services.price_cents` directly. Never mention "tariffs".



\## Calc engine first

\- All business math in `lib/calc` as small pure functions with unit tests.

\- Write/update tests before touching UI. Do not duplicate formulas in components.



\## Pricing and snapshots

\- **IMPORTANT**: Services now store prices directly with built-in discount support. No separate tariffs table or versioning system.

\- **Services table**: Contains `price_cents` (final price with discount), `discount_type`, `discount_value`, `margin_pct`, and cost fields.

\- **Treatments**: Store immutable snapshots at time of treatment: fixedPerMinuteCents, minutes, variableCostCents, marginPct, price_cents.

\- **Historical pricing**: Treatments preserve point-in-time pricing. Service price changes do NOT affect past treatments.

\- **No price versioning**: Services have single current price. If you need historical price analysis, query treatments table.



\## Database modeling (lean)

\- **Active tables**: settings\_time, assets, fixed\_costs, supplies, services, service\_supplies, patients, treatments, expenses.

\- **Deprecated**: `tariffs` table exists for legacy data only. DO NOT USE in new code. Use `services` table for pricing.

\- **Services pricing**: Services table now includes: `price_cents`, `discount_type`, `discount_value`, `discount_reason`, `margin_pct`, cost fields.

\- Simple FKs, NOT NULL where applies. Avoid triggers initially.

\- Treatments store immutable snapshots: `fixed_cost_per_minute_cents`, `variable_cost_cents`, `margin_pct`, `price_cents`.



\## Database Schema Documentation (CRITICAL)

\- **Current schema:** Always reference @docs/database/SCHEMA-CURRENT.md before making ANY database changes.

\- **Schema versioning:** Schema is versioned in `docs/database/schemas/SCHEMA-vX-YYYY-MM-DD.md`

\- **When making migrations or schema changes:**
  1. Check current schema first (@docs/database/SCHEMA-CURRENT.md)
  2. Make the migration changes
  3. Create new schema version file: `docs/database/schemas/SCHEMA-v{N+1}-{TODAY}.md`
  4. Update `docs/database/SCHEMA-CURRENT.md` to reference new version
  5. Add entry to `docs/database/SCHEMA-CHANGELOG.md` documenting changes
  6. Notify user that schema documentation has been updated

\- **Auto-update behavior:** When you detect schema changes (new migrations, table modifications, column additions), IMMEDIATELY:
  - Create new versioned schema file
  - Update SCHEMA-CURRENT.md
  - Update SCHEMA-CHANGELOG.md
  - Tell user: "📊 Schema documentation updated to v{X} - {description of changes}"

\- **Schema check triggers:**
  - Creating/modifying migration files in `supabase/migrations/`
  - Discussing table structure or relationships
  - Adding/removing columns or tables
  - Changing foreign keys or constraints

\- **Always read schema before:**
  - Writing RLS policies
  - Creating new API endpoints that query database
  - Discussing data models or relationships
  - Debugging database-related issues



\## Server vs Client

\- Default to Server Components. Mark Client only for interactive forms/tables.

\- No business logic in components. Use server components or route handlers.



\## UI design system (Apple-like)

\- Clean, airy, soft shadows, radius 16, generous spacing. Max width 1280.

\- Use local wrappers: PageHeader, Card, DataTable, FormField, EmptyState, Skeleton.

\- **REUSE EXISTING COMPONENTS**: 
  - **UI Components** (`components/ui/`): PageHeader, DataTable, FormModal, Card, Button, Badge, Skeleton, EmptyState, ConfirmDialog, ActionDropdown, SummaryCards
  - **Form Components** (`components/ui/form-field.tsx`): FormSection, FormGrid, InputField, SelectField, TextareaField, CheckboxField
  - **Layout Components** (`components/layouts/`): AppLayout, DashboardLayout, CrudPageLayout
  - **Hooks** (`hooks/`): useApi, useCrudOperations, useCurrentClinic, useWorkspace
  - **NEVER create new components** if existing ones can be composed/extended
  - **Search first**, create only if absolutely necessary

\- Accessibility AA, visible focus, 44px targets, labels and aria for errors.



\## Error handling \& logging

\- Validate with Zod. Friendly messages. No env values leaked.

\- Dev: log to console. Prod: quiet for now. Prefer typed results over throws.



\## Performance budgets

\- Keep client bundle ≤ ~170KB gz. Lazy-load heavy tables. Suspense + Skeletons.

\- Use `next/image`. No heavy work on main thread.



\## Security

\- Read Supabase keys from env only. Commit `.env.example` but never real keys.

\- Do not expose service-role keys on client. Sanitize CSV/exports.



\## Coding Standards (MANDATORY)

See @docs/CODING-STANDARDS.md for complete rules. Key points:
\- **MAX 400 lines per file** (ideal <300). Split if exceeded.
\- **MAX 100 lines for CSS files**. Use modular imports for larger styles.
\- **NO direct fetch()** in domain hooks. Use useApi/useCrudOperations.
\- **Money in integer cents ONLY**. Never floats.
\- **All UI strings via useTranslations()**. No hardcoded text.
\- **Business logic in lib/calc/** with tests, never in components.
\- **Extract forms >200 lines** to separate components.
\- **useMemo for expensive calcs**, useCallback for prop functions.
\- **Type safety strict**: No `any` without justification.
\- **COMPONENTIZATION RULE**: All UI elements must be componentized. Never hardcode in layouts. If something needs editing, edit its component or create a new component. Everything must be modular and reusable.

\## Git \& PR discipline

\- Small PRs, one feature or file group. Conventional commits.

\- PR must list Acceptance Criteria and link TASK ids.

\- Touching `lib/calc` => update/add tests.
\- Files >400 lines must be split before merge.



\## Testing \& TDD

\### Usuario de prueba
\- Email: ismaelguimarais@gmail.com
\- Password: test123456
\- Guardado en: `cypress.env.json`

\### Prácticas TDD establecidas
\- Escribir tests ANTES de implementar features
\- Red-Green-Refactor: Fallar → Pasar → Mejorar
\- Ejecutar `npm test` antes de commits
\- Ejecutar `npm run lint` y `npm run typecheck` antes de PRs
\- Actualizar tests cuando se modifica código existente
\- Tests E2E para flujos críticos

\### Notas importantes
\- Registro y eliminación de cuenta no se pueden probar automáticamente (requieren email)
\- Usuario debe completar onboarding (workspace + clínica) después del registro
\- Multi-tenancy debe verificarse en cada módulo nuevo



\## Prompting discipline for the agent

\- Always specify target files and exact diff scope.

\- List Acceptance Criteria and forbidden files. Decline large refactors unless a task breakdown exists.

\- Prefer 5–15 min tasks.



\## Acceptance Criteria (template)

1\) `npm run dev` builds clean  

2\) `npm test` green  

3\) New strings through next-intl en/es  

4\) Money only in cents  

5\) No new deps  

6\) Visuals follow tokens  

7\) No changes outside stated files



\## File structure guardrails

\- Business math in `lib/calc`, money in `lib/money.ts`, Supabase client in `lib/supabase.ts`.

\- UI wrappers in `components/ui`, pages under `app/`. No new top-level folders without approval.



\## Tasks governance (Taskmaster-like)

\- Use top-level `tasks/` folder maintained on every PR.

\- Core files: `tasks/README.md`, `tasks/backlog.md`, `tasks/active.md`, `tasks/done.md`,

&nbsp; `tasks/template.md`, optional one-file-per-large-task `tasks/YYYY-MM-DD-<slug>.md`.

\- Each task has YAML front matter and a checklist:

id: TASK-{{YYYYMMDD}}-<slug>

title: Short imperative title

status: backlog|active|blocked|done

priority: P1|P2|P3

estimate: XS|S|M|L

area: calc|ui|data|infra|docs|i18n|testing

parent: null

links: \[]

&nbsp;acceptance criterion 1



&nbsp;acceptance criterion 2

\- Never open or merge a PR without updating `tasks/`. Split tasks >1 day into subtasks.

\- Weekly rollup file `tasks/week-{{YYYY}}-W{{WW}}.md` with Done, Active, Blocked, Next.



\## Devlog step-by-step (tutorial style)

For \*\*every PR or bugfix\*\*, create `docs/devlog/YYYY-MM-DD-<slug>.md` as if mentoring a junior:

\- Context, Problem, Root cause, What changed, Files touched, Before vs After, How to test,

Risks and rollback, Follow ups with TASK ids.

\- Link PR number and TASK ids at the top. Show new i18n keys and relevant unit tests.



\## Commands \& tips

\- Use `/init` to bootstrap memory, and `/memory` to open/edit memory files.

\- Prefix a line with `#` to quickly add a memory entry and pick the target file.

\- Claude discovers `CLAUDE.md` upward from CWD and in subtrees when reading files.

\- Never open or merge a PR without updating `tasks/`. Split tasks >1 day into subtasks.

\- Weekly rollup file `tasks/week-{{YYYY}}-W{{WW}}.md` with Done, Active, Blocked, Next.



\## Devlog step-by-step (tutorial style)

For \*\*every PR or bugfix\*\*, create `docs/devlog/YYYY-MM-DD-<slug>.md` as if mentoring a junior:

\- Context, Problem, Root cause, What changed, Files touched, Before vs After, How to test,

Risks and rollback, Follow ups with TASK ids.

\- Link PR number and TASK ids at the top. Show new i18n keys and relevant unit tests.



\## Commands \& tips

\- Use `/init` to bootstrap memory, and `/memory` to open/edit memory files.

\- Prefix a line with `#` to quickly add a memory entry and pick the target file.

\- Claude discovers `CLAUDE.md` upward from CWD and in subtrees when reading files.



\# User Memory — Isma



\## Interaction style

\- Talk to me in Spanish. Keep code and identifiers in English.

\- Prefer concise answers with clear bullets, then deeper detail on demand.

\- Break big tasks into small steps of 5–15 minutes with clear acceptance criteria.



\## Coding preferences

\- Apple-like clean UI. Generous spacing, soft shadows, radius 16.

\- Money in integer cents. MXN by default. Use Intl.NumberFormat for locale.

\- Tests first for business math. Avoid heavy dependencies.



\## Workflow

\- Always check `tasks/\*` before coding. Update `active.md` and create subtasks.

\- After a change, write a devlog entry under `docs/devlog/` with step-by-step reasoning.

\- When ambiguous, ask one clarifying question, then propose a minimal plan.

\- No modifiques el archivo .env.local

\- **IMPORTANTE**: Cuando el puerto 3000 está en uso, NO iniciar servidor en otro puerto. El usuario ya está usando el puerto 3000, simplemente hacer los cambios necesarios sin intentar levantar otro servidor.

\## Supabase

\- If you need me to do anything in Supabase, just tell me what to do, guide me, create the modification script or whatever needs to be done, and tell me which reference to use to know which one it is so I can copy and paste it and run it in Supabase and give you the errors if they appear.













