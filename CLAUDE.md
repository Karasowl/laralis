\# Project Memory — Dental App

Reference spreadsheet lives under docs/reference/Consultorio-PoDent.xlsx.
 The spreadsheet is reference for calculations, not a runtime dependency.


See @README.md for overview and @PR.md for PR prompts.

See @tasks/README.md, @tasks/active.md, @tasks/backlog.md for planning.

If present, link to devlog index: @docs/devlog/INDEX.md



\## Language and i18n

\- Reply to the human in Spanish. Code, identifiers and comments in English.

\- All visible UI strings come from next-intl messages. No hardcoded text.

\- Provide keys in `messages/en.json` and translations in `messages/es.json`.

\- Use next-intl number and currency formatting for the active locale.



\## Stack boundaries

\- Next.js 14 App Router + TypeScript. Tailwind + shadcn/ui.

\- Supabase with `@supabase/supabase-js` only. No Prisma/Drizzle for now.

\- Forms with React Hook Form + Zod. Tests with Vitest.

\- Do not add new deps without explicit approval in the PR.



\## Money handling

\- Store money in integer cents only. Never floats.

\- Use helpers in `lib/money.ts`. Round only on explicit business rules.



\## Calc engine first

\- All business math in `lib/calc` as small pure functions with unit tests.

\- Write/update tests before touching UI. Do not duplicate formulas in components.



\## Snapshots and versioning

\- Treatments persist immutable snapshots: fixedPerMinuteCents, minutes, variableCostCents, marginPct, computed price, tariff version.

\- Never recalc historical records. Service recipe or margin change => new version.



\## Database modeling (lean)

\- Tables: settings\_time, assets, fixed\_costs, supplies, services, service\_supplies,

&nbsp; tariffs, patients, treatments, expenses.

\- Simple FKs, NOT NULL where applies. Avoid triggers initially.

\- Treatments store `snapshot\_costs` JSON plus `price\_cents`.



\## Server vs Client

\- Default to Server Components. Mark Client only for interactive forms/tables.

\- No business logic in components. Use server components or route handlers.



\## UI design system (Apple-like)

\- Clean, airy, soft shadows, radius 16, generous spacing. Max width 1280.

\- Use local wrappers: PageHeader, Card, DataTable, FormField, EmptyState, Skeleton.

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



\## Git \& PR discipline

\- Small PRs, one feature or file group. Conventional commits.

\- PR must list Acceptance Criteria and link TASK ids.

\- Touching `lib/calc` => update/add tests.



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

\## Supabase

\- If you need me to do anything in Supabase, just tell me what to do, guide me, create the modification script or whatever needs to be done, and tell me which reference to use to know which one it is so I can copy and paste it and run it in Supabase and give you the errors if they appear.













