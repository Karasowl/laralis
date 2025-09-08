# Improve PR template and acceptance criteria for Laralis

PR: pending
Tasks: [TASK-20250817-pr-template-upgrade]

## Context
The PR document (`docs/memories/PR.md`) needed to reflect the real business flow and constraints described in the product memos. Aligning the PR with the calc-engine-first approach, multi-tenant architecture, i18n, money-in-cents, and governance improves consistency and reduces ambiguity for contributors.

## Problem
The previous PR text focused mostly on UI shell and basic setup. It was missing:
- The immutable configuration dependency chain (Depreciation → Fixed Costs → Time → Break-even → Supplies → Services → Tariffs → Treatments)
- Multi-tenant framing (Workspaces and Clinics)
- Snapshots required in treatments and categories governance
- Clear acceptance criteria for i18n, accessibility (AA), Zod validation, and money in cents
- Tasks and devlog governance reminders

## Root cause
Initial PR memo was created before the full scope in `mvp_sin_cambios.md` and `segunda_actualizacion.md` was consolidated.

## What changed
- Added business foundations and dependency chain diagram
- Documented multi-tenant context: Workspaces → Clinics and snapshots in treatments
- Expanded scope to include groundwork for patient Sources & Referrals (without advanced ROI logic)
- Strengthened Acceptance Criteria: i18n EN/ES, AA, Zod, money in cents, no new deps, scope discipline
- Added Tasks and Devlog governance section
- Extended i18n message keys for structured navigation across Setup, Inventory, Services, Pricing, Patients, Treatments, Workspaces, Clinics

## Files touched
- `docs/memories/PR.md`: Enriched content to align with memos and rules
- `tasks/active.md`: Added active task entry for this PR

## Before vs After

Added navigation i18n keys (excerpt):

```json
// en.json additions
{
  "nav.setup.depreciation": "Depreciation",
  "nav.setup.breakEven": "Break-even",
  "nav.inventory": "Inventory",
  "nav.inventory.supplies": "Supplies",
  "nav.services": "Services",
  "nav.pricing": "Pricing",
  "nav.patients": "Patients",
  "nav.treatments": "Treatments",
  "nav.workspaces": "Workspaces",
  "nav.clinics": "Clinics"
}
```

```json
// es.json additions
{
  "nav.setup.depreciation": "Depreciación",
  "nav.setup.breakEven": "Punto de equilibrio",
  "nav.inventory": "Inventario",
  "nav.inventory.supplies": "Insumos",
  "nav.services": "Servicios",
  "nav.pricing": "Precios",
  "nav.patients": "Pacientes",
  "nav.treatments": "Tratamientos",
  "nav.workspaces": "Espacios de trabajo",
  "nav.clinics": "Clínicas"
}
```

Acceptance criteria reinforced (excerpt):

```diff
- npm test verde en todos los módulos de cálculo
+ npm test verde en lib/calc/__tests__ (depreciación, tiempo, variable, tarifa, equilibrio, redondeo)
+ Todo el dinero en centavos usando lib/money.ts
+ i18n EN/ES: todas las cadenas en messages/en.json y messages/es.json
+ WCAG AA (contraste, focus visible, targets ≥ 44px, no color-only)
+ Validación con Zod y errores amigables
```

## How to test
1. Install deps: `npm i`
2. Run unit tests: `npm test`
3. Start dev server: `npm run dev`
4. Verify i18n toggle EN ↔ ES and navigation sections exist (keys present in messages)
5. Validate AA basics: focus outlines visible, adequate contrast, tap targets height ≥ 44px
6. Confirm money formatting uses Intl and internal handling is in cents

## Risks and rollback
- Low risk: documentation-only changes plus tasks list. If confusion arises, revert the specific sections in `docs/memories/PR.md`.

## Follow ups
- Wire the new i18n navigation keys into `components/NavigationClient.tsx`
- Create sources/referrals minimal UI placeholders under the Reports/Patients area
- Add a short contributor guide referencing the dependency chain and calc-engine tests


