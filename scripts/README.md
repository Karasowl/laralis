# Scripts

| Script | Uso |
|---|---|
| `bump-version.js` | Bump de versión de la app dental (`npm run version:patch\|minor\|major` desde `apps/dental`). |
| `open-cypress-stage.ps1` | Abre Cypress contra stage. Lo lanza `Abrir Cypress Stage.bat` en la raíz. |
| `clear-browser-cache.js` | Pegar en la consola del navegador para limpiar caché y storage local. |
| `test-api-categories.js` | Prueba manual del endpoint de categorías. |

Los scripts SQL de mantenimiento de Supabase se eliminaron el 2026-10-04: los datos viven en Convex
y el proyecto de Supabase ya no existe. Siguen disponibles en el historial de git
(`git log --diff-filter=D --name-only -- '*.sql'`).
