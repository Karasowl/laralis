I18n Maintenance Playbook

Overview

- Purpose: Keep EN and ES messages in sync and avoid runtime MISSING_MESSAGE errors.
- Layout: Messages live under `web/messages`. Runtime loading/merging is defined in `web/i18n/request.ts`.

Runtime Merge Strategy

- Locale detection: Reads `locale` cookie; defaults to `en`.
- Base load: `../messages/${locale}.json`.
- For `es`: Deep‑merge EN → ES → `es-overrides.json` (fallback to EN for missing keys, then apply Spanish overrides).
- For `en`: Deep‑merge EN → `en-overrides.json` (allow quick patches without touching base).
- Code: See `web/i18n/request.ts`.

CLI Scripts

- `npm -C web run i18n:check`: Compares effective EN/ES keys and prints missing keys per locale.
- `npm -C web run i18n:fill`: Auto‑fills missing EN keys using ES values into `web/messages/en-overrides.json`.

When To Run

- After adding UI strings or changing namespaces.
- Before PRs touching messages.
- When Intl logs show MISSING_MESSAGE in the browser/console.

Typical Workflows

- Add strings in both locales:
  - Edit `web/messages/en.json` and `web/messages/es.json`.
  - Run `npm -C web run i18n:check` to confirm 0 missing.

- Added only Spanish strings (temporary):
  - Edit `web/messages/es.json` (or `es-overrides.json`).
  - Run `npm -C web run i18n:fill` to copy missing ES keys into `en-overrides.json`.
  - Run `npm -C web run i18n:check` to verify 0 missing.
  - Later, replace placeholders in EN with proper English.

Key Conventions

- Namespaces: Use `useTranslations('services')` for service‑specific keys; use `useTranslations('common')` for shared keys.
- Do not chain namespaces: Avoid `t('common.actions')` inside `services` namespace. Use a separate `tCommon('actions')`.
- Case: Prefer camelCase in component code and message files (e.g., `addCategory`, `categoryName`, `categoryNamePlaceholder`).
- Global keys: Some UI labels like `existing_categories` may live at the root (used across modules). Access with `useTranslations()` (no namespace) when needed.

Examples In Code

- Services table actions label uses common namespace:
  - File: `web/app/services/components/ServicesTable.tsx`
  - Use `tCommon('actions')` instead of `t('common.actions')`.

- Category modal keys aligned to camelCase and namespaces:
  - File: `web/app/services/components/CategoryModal.tsx`
  - Submit: `t('addCategory')`
  - Input label: `t('categoryName')`
  - Placeholder: `t('categoryNamePlaceholder')`
  - Existing list title (root): `tRoot('existing_categories')`

Files Of Interest

- `web/i18n/request.ts`: Runtime messages loader and merge logic.
- `web/scripts/check-i18n.mjs`: Reports missing keys across locales.
- `web/scripts/fill-i18n-missing.mjs`: Auto‑fills EN overrides using ES values.
- `web/messages/en.json`, `web/messages/es.json`: Base dictionaries.
- `web/messages/en-overrides.json`, `web/messages/es-overrides.json`: Fast fixes and environment‑specific overrides.

Troubleshooting

- MISSING_MESSAGE: Verify key path and namespace; run `npm -C web run i18n:check`.
- Duplicate identifier in `autoinsert.js`: Usually a browser extension; test in Incognito with extensions disabled.
- `Unchecked runtime.lastError: The message port closed...`: Also from extensions; harmless to the app.

Notes

- The scripts flatten nested objects for comparison (dot notation like `services.fields.name`).
- Deep merge prefers values from the later source (overrides win over base).

