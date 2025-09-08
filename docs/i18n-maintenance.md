I18n Maintenance Guide (ES/EN)

Overview

- Goal: keep 0 missing messages for EN/ES with no hardcoded UI texts. All strings live in JSON under `web/messages/` and the app uses `t('…')` exclusively.
- Effective bundles: EN = `en.json` + `en-overrides.json`; ES = `en.json` + `es.json` + `es-overrides.json`.

Key Scripts

- Collect used keys: `node web/scripts/collect-used-i18n.mjs` → writes `web/scripts/used-keys.json`.
- Check missing: `node web/scripts/missing-used-i18n.mjs` → compares used keys against effective EN/ES bundles.
- Autofill overrides: `node web/scripts/autofill-i18n.mjs` → adds any missing keys to `en-overrides.json` and `es-overrides.json` with reasonable defaults.
- Final normalization (manual fixes added): `node web/scripts/finalize-i18n.mjs` → enforces specific keys we standardized in this pass (treatments, settings.* groups, expenses, marketing).

Normalization Rules Applied

- Avoid plain group keys with namespaced translators. Examples:
  - Bad: `useTranslations('expenses')` + `t('expenses')`
  - Good: `useTranslations('expenses')` + `t('title')` OR global `tg('expenses.title')`
  - Bad: `useTranslations('equilibrium')` + `t('settings')`
  - Good: add `const tNav = useTranslations('navigation')` and use `tNav('settings')`
- Actions: ensure nested keys exist under `actions.*` (e.g., `actions.cancel`, `actions.view`, etc.).
- Settings/Marketing/Workspaces/Clinics: standardized the exact keys used by UI (e.g., `settings.workspaces.emptyTitle`, `settings.marketing.campaignRestored`, …).
- Treatments: added full set for CRUD, fields, placeholders, and summary cards.
- Expenses: added entity/title/description and alerts placeholder keys used by the new page.

How To Keep It At Zero

1) Refresh used keys and check
   - `node web/scripts/collect-used-i18n.mjs`
   - `node web/scripts/missing-used-i18n.mjs`

2) Autofill new keys
   - `node web/scripts/autofill-i18n.mjs`
   - Re-run the check. If anything remains, it’s a structural/alias issue (see next).

3) Fix structural mismatches
   - If a component uses `useTranslations('X')` then do NOT call `t('X')` — call `t('title')` or switch to a global translator `tg('X.title')`.
   - Prefer explicit full-path keys for cross-namespace labels: e.g., use `tg('navigation.settings')` rather than relying on an unrelated namespace.
   - If the check still shows a group key (like `settings`), search with `node web/scripts/find-plain-keys.mjs` to locate and update the call sites.

4) Lock in common fixes
   - `node web/scripts/finalize-i18n.mjs` will apply the specific keys we normalized in this iteration (safe to run anytime).

Validation

- Run: `node web/scripts/missing-used-i18n.mjs` → it must print `countEn: 0`, `countEs: 0`.
- Optional sanity: search for `t('…')` group-only calls with `node web/scripts/find-plain-keys.mjs` and ensure they’re intentional (prefer full-path keys).

Notes

- Do not add hardcoded texts in components — always use `t('…')`.
- Prefer overrides (`*-overrides.json`) for rapid iteration; move stable text upstream later if needed.
- If you introduce a new page/namespace, add `...title`, `...subtitle`, `...description`, field labels, and any CRUD strings early to avoid gaps.

