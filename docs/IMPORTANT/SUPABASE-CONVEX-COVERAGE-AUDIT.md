# Auditoria Supabase -> Convex

Fecha: 2026-05-31
Repo: `C:\Users\adven\OneDrive\Documentos\dev-projects\laralis`
App real: `apps/dental`
Produccion: `https://laralis.vercel.app`

## Actualizacion operativa - 2026-05-31 19:55 America/Mexico_City

Credencial Convex creada para la cuenta real indicada por el usuario:

- Se encontro una sola cuenta Supabase Auth que coincide con el identificador
  `conladoctoralara` (`co***@gmail.com`).
- Se genero un reset Convex nuevo y se consumio inmediatamente con la password
  indicada por el usuario.
- `POST /api/auth/convex-password-reset/complete` respondio `200`.
- `POST /api/auth/convex-login` en produccion dual respondio `200`.
- `GET /api/auth/me` con la cookie Convex respondio `200`.
- Se consumio tambien el reset Convex viejo de esa misma cuenta que estaba en
  el archivo de enlaces anterior, para no dejar un token activo reutilizable.
- Verificacion final posterior: login Convex `200`, `/api/auth/me` `200`.
- Health production posterior:
  - `passwordCredentials=1`.
  - `migratedAuthUsers=3`.
  - `AUTH_BACKEND=dual`.
  - `DATA_READ_BACKEND=supabase`.
  - `DATA_WRITE_MODE=dual`.
- Compare completo production de 57 tablas sigue `ok=true`,
  `badCompareTables=0`.

Canary Convex-only con la misma cuenta:

- Preview: `https://laralis-lsoqqazxf-avanxia-labs.vercel.app`.
- Login Convex-only: `200`.
- `GET /api/auth/me`: `200`.
- `GET /api/workspaces?list=true`: `200`, `workspaceCount=1`.
- `GET /api/clinics`: `200`, `clinicCount=1`.
- `/` despues de login: `200`.

Evidencia local:

- `tmp/convex-production-verification/convex-complete-target-20260601T015308Z.json`
- `tmp/convex-production-verification/convex-login-target-20260601T015308Z.json`
- `tmp/convex-production-verification/convex-me-target-20260601T015308Z.json`
- `tmp/convex-production-verification/health-production-target-credential-20260601T015331Z.json`
- `tmp/convex-production-verification/compare-all-production-target-credential-20260601T015331Z.json`
- `tmp/convex-preview-verification/convex-only-target-login-20260601T015414Z.json`
- `tmp/convex-preview-verification/convex-only-target-workspaces-20260601T015414Z.json`
- `tmp/convex-preview-verification/convex-only-target-clinics-20260601T015414Z.json`
- `tmp/convex-production-verification/health-production-target-final-20260601T015545Z.json`

Lectura correcta:

- La cuenta real ya puede autenticar contra Convex.
- Produccion todavia no esta cortada a Convex-only; sigue en modo dual seguro.
- El siguiente corte seguro es cambiar un entorno canary/preview con este mismo
  artefacto a `AUTH_BACKEND=convex` y `DATA_READ_BACKEND=convex`, recorrer CRUD
  principal con la cuenta real, y solo despues evaluar cambiar produccion.

## Actualizacion operativa - 2026-05-31 17:58 America/Mexico_City

Produccion desplegada en modo seguro dual:

- Se desplego produccion con build de produccion, no promoviendo el canary
  Convex-only.
- Produccion queda en:
  - `AUTH_BACKEND=dual`.
  - `NEXT_PUBLIC_AUTH_BACKEND=dual`.
  - `DATA_READ_BACKEND=supabase`.
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
  - `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Lectura visible y Auth principal siguen seguras en Supabase.
- Las escrituras de la app quedan preparadas para dual-write hacia Supabase y
  Convex.
- Convex sigue sincronizado contra Supabase: compare completo de 57 tablas
  `ok=true`, `badCompareTables=0`.

Hotfix post-deploy:

- Vercel logs detecto error en `/api/cron/retry-notifications` porque la tabla
  opcional `notification_retry_queue` no existe en Supabase production.
- Se ajusto `listDueNotificationRetries` para tratar esa ausencia como no-op.
- Verificacion posterior:
  - `/api/cron/retry-notifications?limit=1` responde `200`.
  - Mensaje: `No due notification retries`.
  - Logs de error production ultimos 2 minutos: sin errores.

Estado Auth:

- `migratedAuthUsers=3`.
- `passwordCredentials=0`.
- Se generaron enlaces de reset Convex de produccion para las 3 cuentas
  migradas, con vencimiento 2026-06-01T23:55Z.
- Los tokens fueron verificados con `200` sin consumirlos.
- Archivo local sensible con los enlaces:
  `tmp/convex-production-verification/convex-reset-links-production-20260531T235537Z.json`.
- No se imprimieron tokens en el chat ni en documentacion.

Evidencia local:

- `tmp/convex-migration-audit/dual-write-coverage-20260531T235104Z.json`
- `tmp/convex-production-verification/health-production-hotfix-20260531T235404Z.json`
- `tmp/convex-production-verification/compare-all-production-hotfix-20260531T235404Z.json`
- `tmp/convex-production-verification/cron-retry-notifications-hotfix-20260531T235404Z.json`

Siguiente paso exacto para dejar de necesitar Supabase:

- Completar el reset Convex para cada cuenta real desde su enlace.
- Verificar que `passwordCredentials` suba de `0` a `3`.
- Probar login con password Convex en preview/produccion dual.
- Solo despues cambiar preview a `AUTH_BACKEND=convex`, correr flujos privados,
  y luego preparar corte de produccion a Convex-only.

## Actualizacion operativa - 2026-05-31 17:46 America/Mexico_City

Avance nuevo de frontend hacia Convex-only:

- Se agrego `GET /api/auth/me`, usando `getCurrentUser`, para que el cliente
  resuelva la sesion desde Supabase o desde la cookie Convex segun el backend.
- `WorkspaceProvider` ya no llama directo a `supabase.auth.getUser()` para la
  carga inicial ni para `refreshUser`.
- `WorkspaceProvider` ya no consulta `clinics` directo en Supabase; ahora usa
  `/api/clinics?workspaceId=...`, que respeta `DATA_READ_BACKEND=convex`.
- En `AUTH_BACKEND=convex`, el provider ya no crea cliente Supabase de browser
  para escuchar auth state.
- `/api/clinics` ahora conserva el comportamiento de solo devolver clinicas
  activas tambien por el camino Convex.

Preview canary verificado:

- Preview: `https://laralis-lsoqqazxf-avanxia-labs.vercel.app`.
- Flags runtime:
  - `AUTH_BACKEND=convex`.
  - `NEXT_PUBLIC_AUTH_BACKEND=convex`.
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
- Health canary: `ok=true`, `convexHost=superb-grouse-940.convex.cloud`.
- Compare completo de 57 tablas: `ok=true`, `badCompareTables=0`.
- Rutas verificadas con Vercel bypass:
  - `/auth/login` responde `200`.
  - `/api/auth/me` sin sesion responde `401`.
  - `/` sin sesion redirige a `/auth/login?redirectTo=%2F`.
- Build local: `npm --prefix apps/dental run build` pasa.
- Auditoria dual-write: `node apps/dental/scripts/migration/audit-dual-write-coverage.mjs --strict`
  pasa con `highRisk=0`, `manualReview=0`.
- `npm --prefix apps/dental run typecheck` sigue fallando por deuda previa del
  repo; no aparecen errores en los archivos tocados para este bloque.

Evidencia local:

- `tmp/convex-migration-audit/dual-write-coverage-20260531T234053Z.json`
- `tmp/convex-preview-verification/health-workspace-provider-20260531T234454Z.json`
- `tmp/convex-preview-verification/compare-all-workspace-provider-20260531T234454Z.json`

Bloqueo pendiente para dejar de necesitar Supabase:

- `migratedAuthUsers=3`.
- `passwordCredentials=0`.
- El proximo paso real es crear por lo menos una credencial Convex con una
  cuenta migrada, usando el reset Convex protegido o el bridge durante login
  Supabase. Sin esto, Convex tiene datos pero no puede autenticar usuarios.
- Despues de que `passwordCredentials >= migratedAuthUsers`, se puede probar
  login Convex real en preview y recien despues preparar corte de produccion.

## Actualizacion operativa - 2026-05-31 17:37 America/Mexico_City

Avance nuevo de middleware hacia Convex-only:

- El middleware ya no crea cliente Supabase cuando `AUTH_BACKEND=convex`.
- Si faltan variables Supabase en un entorno Convex-only, el middleware puede
  seguir funcionando con la cookie `laralis_convex_session`.
- `/auth/convex-reset-password` quedo marcado como ruta publica.
- `/auth/logout` ahora limpia cookies aunque Supabase no este configurado.
- Esto elimina un bloqueo importante: antes un login Convex podia crear sesion,
  pero el middleware todavia podia depender de Supabase o bloquear el reset.

Canary Convex-only verificado:

- Preview: `https://laralis-cdup8sre2-avanxia-labs.vercel.app`.
- Flags runtime:
  - `AUTH_BACKEND=convex`.
  - `NEXT_PUBLIC_AUTH_BACKEND=convex`.
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
- Health canary: `ok=true`, `convexHost=superb-grouse-940.convex.cloud`.
- Compare completo de 57 tablas: `ok=true`, `badCompareTables=0`.
- Con Vercel bypass cookie activa:
  - `/auth/login` responde `200`.
  - `/auth/convex-reset-password` responde `200`.
  - `/auth/logout` redirige a `/auth/login`.
  - `/` sin sesion redirige a `/auth/login?redirectTo=%2F`.
- Build local: `npm --prefix apps/dental run build` pasa.
- Auditoria dual-write: `node apps/dental/scripts/migration/audit-dual-write-coverage.mjs --strict`
  pasa con `highRisk=0`, `manualReview=0`.

Evidencia local:

- `tmp/convex-migration-audit/dual-write-coverage-20260531T233300Z.json`
- `tmp/convex-preview-verification/health-convex-auth-backend-20260531T173651Z.json`
- `tmp/convex-preview-verification/compare-all-convex-auth-backend-20260531T173730Z.json`

Bloqueo pendiente:

- `passwordCredentials=0`.
- Convex-only Auth no puede considerarse listo hasta que una cuenta migrada
  complete login/reset y cree credencial Convex.
- Despues de eso hay que probar login real con `AUTH_BACKEND=convex` en este
  canary y recorrer flujos autenticados.

## Actualizacion operativa - 2026-05-31 17:31 America/Mexico_City

Avance adicional:

- El flujo existente de Supabase reset password (`/auth/reset-password`) ahora
  intenta alimentar el bridge de Convex despues de un cambio exitoso de
  password, cuando `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Esto cubre dos caminos de migracion de credenciales:
  - login normal Supabase -> bridge Convex;
  - reset password Supabase -> bridge Convex.
- Se redeplego preview canary:
  `https://laralis-qhy5k1qa4-avanxia-labs.vercel.app`.
- Health canary: `ok=true`, `convexHost=superb-grouse-940.convex.cloud`,
  `DATA_READ_BACKEND=convex`, `DATA_WRITE_MODE=dual`, `AUTH_BACKEND=dual`.
- `/auth/reset-password` responde `200`.
- `/auth/convex-reset-password` responde `200`.
- `passwordCredentials` sigue en `0` porque todavia no se completo login/reset
  real de una cuenta migrada.

Evidencia local:

- `tmp/convex-migration-audit/dual-write-coverage-20260531T232800Z.json`
- `tmp/convex-preview-verification/health-reset-bridge-20260531T173112Z.json`

## Actualizacion operativa - 2026-05-31 17:26 America/Mexico_City

Avance nuevo hacia Convex-only Auth:

- Se agrego un bootstrap/reset de password Convex independiente de Supabase:
  - `POST /api/auth/convex-password-reset/request`
  - `GET /api/auth/convex-password-reset/verify`
  - `POST /api/auth/convex-password-reset/complete`
  - Pagina: `/auth/convex-reset-password`
- La creacion de enlace esta protegida por `CRON_SECRET`.
- El token se guarda en Convex como hash SHA-256, no como token plano.
- Completar el reset crea/actualiza la credencial en
  `auth_password_credentials` y establece cookie de sesion Convex.
- Esto permite migrar un usuario existente a password Convex sin conocer su
  password anterior y sin depender de Supabase Auth para el reset.

Estado desplegado y verificado:

- Convex production actualizado: `superb-grouse-940.convex.cloud`.
- Preview canary actualizado:
  `https://laralis-4ms6si6dh-avanxia-labs.vercel.app`.
- Health canary: `ok=true`, `convexHost=superb-grouse-940.convex.cloud`,
  `DATA_READ_BACKEND=convex`, `DATA_WRITE_MODE=dual`, `AUTH_BACKEND=dual`.
- Compare completo canary de 57 tablas: `ok=true`, `badCompareTables=0`.
- Pagina `/auth/convex-reset-password` responde `200`.
- `GET /api/auth/convex-password-reset/verify?token=invalid` responde `400`.
- `POST /api/auth/convex-password-reset/request` sin secreto responde `401`.
- `POST /api/auth/convex-password-reset/request` con secreto y email no
  existente responde `400`; no se genero credencial real.
- Build local: `npm --prefix apps/dental run build` pasa.
- Auditoria de dual-write: `node apps/dental/scripts/migration/audit-dual-write-coverage.mjs --strict`
  pasa con `highRisk=0`, `manualReview=0`.

Evidencia local:

- `tmp/convex-migration-audit/dual-write-coverage-20260531T232317Z.json`
- `tmp/convex-preview-verification/health-auth-reset-20260531T172638Z.json`
- `tmp/convex-preview-verification/compare-all-auth-reset-20260531T172638Z.json`

Siguiente paso exacto:

- Generar un enlace de reset Convex para una cuenta real migrada.
- La usuaria define su password en `/auth/convex-reset-password`.
- Verificar que `passwordCredentials` suba de `0` a por lo menos `1`.
- Probar login con `AUTH_BACKEND=convex` en preview.
- Solo si ese login y los flujos autenticados funcionan, se puede avanzar a
  cortar dependencia de Supabase Auth.

## Actualizacion operativa - 2026-05-31 17:17 America/Mexico_City

Estado nuevo verificado:

- Produccion sigue protegida: `https://laralis.vercel.app` continua con
  `DATA_READ_BACKEND=supabase`, `DATA_WRITE_MODE=dual` y
  `DATA_WRITE_MODE_STORAGE=dual`.
- NO se borro, cancelo ni desactivo Supabase.
- Se levanto un preview canary protegido por Vercel Authentication:
  `https://laralis-bxtwa77ne-avanxia-labs.vercel.app`.
- Ese preview canary ya lee desde Convex production:
  `DATA_READ_BACKEND=convex`.
- Ese preview canary mantiene escrituras en doble via:
  `DATA_WRITE_MODE=dual`, `DATA_WRITE_MODE_STORAGE=dual`.
- Ese preview canary usa Convex production correcto:
  `superb-grouse-940.convex.cloud`.
- Health canary: `ok=true`, `mutationCheck=true`, Auth bridge runtime presente,
  `AUTH_BACKEND=dual`, `NEXT_PUBLIC_AUTH_BACKEND=dual`,
  `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Compare completo canary de 57 tablas: `ok=true`, `badCompareTables=0`.
- Rutas privadas sin sesion en canary (`/api/workspaces`, `/api/clinics`)
  responden `401`, como se espera.

Evidencia local generada:

- `tmp/convex-preview-verification/health-canary-20260531T171648Z.json`
- `tmp/convex-preview-verification/compare-canary-20260531T171648Z.json`
- `tmp/convex-preview-verification/compare-all-canary-20260531T171723Z.json`

Bloqueo real para dejar de necesitar Supabase:

- Convex ya tiene los 3 usuarios de Supabase Auth migrados como registros
  (`migratedAuthUsers=3`), pero aun no tiene credenciales de password
  capturadas (`passwordCredentials=0`).
- Por eso `readyForConvexPasswordLogin=false`.
- Supabase Auth no se puede apagar hasta que al menos la usuaria real inicie
  sesion con el bridge activo o se implemente un flujo de reset/migracion de
  password hacia Convex.
- Despues de Auth, falta ampliar el canary desde las rutas base ya migradas
  hacia el resto de lecturas, RPC, Storage y flujos usados por la usuaria real.

Lectura correcta:

- Ya no estamos en fase "solo investigacion": existe un canary real que lee
  Convex y compara contra Supabase sin diferencias en 57 tablas.
- El siguiente paso seguro NO es cancelar Supabase. El siguiente paso es hacer
  pruebas funcionales autenticadas en el preview canary y capturar/migrar las
  credenciales de Auth para poder probar `AUTH_BACKEND=convex`.
- Este bloque es mas reciente que las secciones historicas de abajo.

## Actualizacion operativa - 2026-05-31 16:34 America/Mexico_City

Estado actual verificado:

- Supabase NO se borro, NO se cancelo y sigue como Auth/lectura principal de produccion.
- Convex production usado por Vercel: `superb-grouse-940.convex.cloud`.
- Se desplego Vercel production desde el workspace local y quedo aliasado a `https://laralis.vercel.app`.
- Se agrego proteccion en `.vercelignore` para excluir `apps/**/.env*.local` y evitar que un deploy local de Vercel compile con variables locales de desarrollo.
- Se forzo `cache: no-store` en el `ConvexHttpClient` server-side para que los endpoints de migracion no lean resultados viejos en Next/Vercel.
- Health production con `mutationCheck=1`: `ok=true`, `mutationCheck=true`, `convexHost=superb-grouse-940.convex.cloud`.
- Full sync production completo: `ok=true`, `tables=57`, `failed=0`, `supabaseRows=2305`, `inserted=0`, `updated=0`, `deleted=0`.
- Event sync production: `ok=true`, `fetched=0`, `processed=0`, `failed=0`.
- Compare profundo production de 57 tablas: `ok=true`, `bad=0`, `issues=0`.

Evidencia local generada:

- `tmp/convex-production-verification/health-nostore-20260531T163424Z.json`
- `tmp/convex-production-verification/full-sync-nostore-20260531T163449Z.json`
- `tmp/convex-production-verification/event-sync-nostore-20260531T163449Z.json`
- `tmp/convex-production-verification/compare-all-nostore-20260531T163449Z.json`

Lectura correcta:

- Ya hay paridad de datos base Supabase -> Convex para las 57 tablas comparadas.
- Produccion todavia NO es Convex-only porque `DATA_READ_BACKEND` sigue en `supabase` y hay superficies que aun dependen de Supabase: Auth, Storage, Realtime, RPC y lecturas/API no migradas.
- El siguiente paso para dejar de necesitar Supabase es levantar un canary/preview con `DATA_READ_BACKEND=convex`, cubrir las rutas de lectura restantes y despues migrar Auth/Storage/RPC. Cancelar Supabase antes de eso rompe login, archivos o rutas que aun usan Postgres/RPC.

Actualizacion de avance:

- Se agrego una clave legacy compartida para Convex en `apps/dental/lib/convex/legacy.ts`.
- `user_settings` ya no depende de indice de fila; usa clave compuesta estable.
- `replaceTableSnapshot` en Convex ahora reemplaza el documento completo y elimina campos obsoletos.
- `convex-compare` distingue tablas ausentes en Supabase de diferencias reales y usa la misma clave legacy.
- `convex-sync` y runtime mirror usan la misma resolucion de legacy ID.
- La migracion SQL del outbox queda preparada para calcular `record_id` compuesto de `user_settings`.
- `convex-health` ahora soporta `mutationCheck=1` para validar el secreto Convex sin modificar datos.
- Verificacion local: `npm --prefix apps/dental run build` pasa.
- Verificacion local: `npx vitest run --config apps/dental/vitest.migration.config.mjs` pasa, 9 tests.
- Verificacion local: `node apps/dental/scripts/migration/audit-dual-write-coverage.mjs --strict` pasa con `highRisk=0` y `manualReview=0`.
- `npx tsc --noEmit --project apps/dental/tsconfig.json` sigue fallando por deuda amplia existente fuera del tramo de migracion; el build de Next ya salta typecheck en este repo.

## Veredicto ejecutivo

No. Actualmente Laralis todavia no puede funcionar sin Supabase.

El estado correcto es:

- Supabase sigue siendo la fuente principal de lectura y Auth.
- Convex ya esta conectado como base paralela.
- Las escrituras principales de base de datos estan cubiertas por dual-write/runtime mirror/outbox.
- Convex tiene datos migrados, pero la comparacion aun no esta 100% limpia.
- Auth, muchas lecturas, RPC, Realtime y Storage todavia dependen de Supabase.

Por eso el proximo paso no es cancelar Supabase. El proximo paso es llegar a un preview donde la app funcione con Convex como lectura principal y Supabase solo como respaldo de escritura/rollback.

## Estado verificado

### Produccion y flags

Ultima verificacion operativa registrada:

- `DATA_BACKEND=MISSING`
- `DATA_READ_BACKEND=supabase`
- `DATA_WRITE_MODE=dual`
- `DATA_WRITE_MODE_STORAGE=dual`
- `CONVEX_FULL_SYNC_ENABLED=1`
- `CONVEX_MIRROR_SYNC_ENABLED=1`
- `CONVEX_RUNTIME_MIRROR_ENABLED=MISSING`
- `CONVEX_RUNTIME_MIRROR_STRICT=MISSING`
- `NEXT_PUBLIC_CONVEX_URL=PRESENT`
- `NEXT_PUBLIC_SUPABASE_URL=PRESENT`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=PRESENT`
- `SUPABASE_SERVICE_ROLE_KEY=PRESENT`
- `SUPABASE_DB_URL=MISSING`
- `CRON_SECRET=PRESENT`
- `CONVEX_AUTH_BRIDGE_SECRET`: aparece como variable `Encrypted` en `vercel env ls`, pero `vercel env pull --environment=production` devolvio longitud `0` para su valor.

Implicacion:

- Las lecturas de produccion siguen saliendo de Supabase.
- Las escrituras de produccion deben escribirse en Supabase y Convex.
- Convex no es todavia el backend activo de lectura para usuarios.
- La parte que llama mutations de Convex por `CONVEX_AUTH_BRIDGE_SECRET` no se puede considerar verificada hasta corregir o confirmar ese secreto en runtime. Si el valor realmente esta vacio, helpers como `upsertConvexDocumentByLegacyId`, `replaceConvexTableSnapshot`, `patchConvexDocumentByLegacyId`, `deleteConvexDocumentByLegacyId` y Convex Storage fallan antes de escribir.

### Endpoints productivos de migracion

Verificacion contra `https://laralis.vercel.app` usando `CRON_SECRET` de production, sin imprimir secretos:

```text
health_ok=True; health_tables=19; mismatches=0
compare_ok=False; compare_tables=57; bad_tables=15
full_sync_dry_ok=True; tables=57; failed=0; supabaseRows=2305
mirror_sync_dry_ok=True; fetched=0; processed=0; failed=0
```

Lectura correcta:

- El health default esta verde, pero solo cubre 19 tablas.
- El compare completo de 57 tablas no esta verde.
- Full-sync dry-run puede leer Supabase y contar 2305 filas.
- El outbox no tenia eventos pendientes al momento de la prueba.
- Esto confirma que no es seguro afirmar "todo Supabase ya se hace con Convex".

### Tablas reales vs allowlist de migracion

El dry-run de full-sync en produccion reporto:

```text
full_dry_present_tables=45
missing_tables=12
supabaseRows=2305
```

Tablas declaradas en el allowlist/codigo que no existen en Supabase production:

- `chat_sessions`
- `chat_messages`
- `ai_feedback`
- `public_bookings`
- `public_booking_services`
- `booking_blocked_slots`
- `quotes`
- `quote_items`
- `notification_retry_queue`
- `whatsapp_notifications`
- `whatsapp_templates`
- `action_logs`

Tablas con datos reales y conteo Convex igual al conteo Supabase en el dry-run:

| Tabla | Supabase | Convex antes |
| --- | ---: | ---: |
| `ai_chat_messages` | 81 | 81 |
| `ai_chat_sessions` | 20 | 20 |
| `assets` | 21 | 21 |
| `categories` | 71 | 71 |
| `category_types` | 4 | 4 |
| `clinic_google_calendar` | 1 | 1 |
| `clinic_snapshots` | 239 | 239 |
| `clinic_users` | 4 | 4 |
| `clinics` | 4 | 4 |
| `custom_categories` | 100 | 100 |
| `email_notifications` | 2 | 2 |
| `expenses` | 122 | 122 |
| `fixed_costs` | 12 | 12 |
| `marketing_campaigns` | 6 | 6 |
| `medications` | 15 | 15 |
| `patient_sources` | 60 | 60 |
| `patients` | 246 | 246 |
| `prescription_items` | 1 | 1 |
| `prescriptions` | 1 | 1 |
| `push_notifications` | 43 | 43 |
| `push_subscriptions` | 1 | 1 |
| `role_permissions` | 463 | 463 |
| `service_supplies` | 176 | 176 |
| `services` | 27 | 27 |
| `settings_time` | 4 | 4 |
| `sms_notifications` | 41 | 41 |
| `supabase_auth_users` | 3 | 3 |
| `supplies` | 75 | 75 |
| `treatments` | 430 | 430 |
| `user_settings` | 1 | 1 |
| `workspace_activity` | 19 | 19 |
| `workspace_members` | 4 | 4 |
| `workspace_users` | 4 | 4 |
| `workspaces` | 4 | 4 |

Conteo igual no equivale a paridad exacta: `convex-compare` todavia falla en contenido/clave para algunas tablas.

### Auditoria de dual-write

Comando ejecutado:

```powershell
node apps/dental/scripts/migration/audit-dual-write-coverage.mjs --strict
```

Resultado:

```json
{
  "ok": true,
  "outputPath": "tmp\\convex-migration-audit\\dual-write-coverage-20260531T220248Z.json",
  "totals": {
    "filesScanned": 438,
    "filesWithSupabaseWrites": 101,
    "filesWithDirectClientImports": 33,
    "highRisk": 0,
    "manualReview": 0
  }
}
```

Lectura correcta:

- Buena noticia: no aparecen escrituras Supabase de alto riesgo sin cobertura evidente.
- Limite: esta auditoria valida escrituras, no prueba que Auth, lecturas, Storage, RPC o Realtime ya puedan vivir sin Supabase.

### Auditoria de superficie Supabase

Archivo de auditoria:

`tmp\convex-migration-audit\supabase-convex-coverage-20260531T215021Z.json`

Resumen:

```json
{
  "filesWithSupabaseSurface": 243,
  "featureCounts": {
    "dbRead": 167,
    "dbWrite": 109,
    "auth": 73,
    "storage": 2,
    "rpc": 10,
    "realtime": 1,
    "directConvex": 46,
    "backendSelector": 38,
    "runtimeMirrorCandidate": 185
  }
}
```

Gaps detectados:

```json
{
  "auth_still_supabase": 73,
  "db_read_still_supabase_only_or_not_backend_selected": 127,
  "db_write_without_obvious_convex_or_mirrored_wrapper": 6,
  "realtime_not_replaced_by_convex": 1,
  "storage_read_or_write_still_supabase_only": 1
}
```

Nota: los 6 casos de `db_write_without_obvious_convex_or_mirrored_wrapper` son falsos positivos del escaner simple; corresponden a `crypto.update`, `cookies.delete`, `Set.delete`, `Map.delete` y no a escrituras Supabase. La auditoria estricta de dual-write sale limpia.

Reconteo actual limitado a `apps/dental/app`, `apps/dental/lib`, `apps/dental/hooks` y `apps/dental/middleware.ts`:

```text
supabase_surface_files=234
auth_files=69
rpc_files=11
storage_files=10
realtime_files=1
```

Este reconteo confirma que la migracion no esta en una etapa "Convex-only"; todavia hay una superficie Supabase amplia.

## Que ya esta cubierto

### 1. Dual-write de base de datos

Existe una capa de backend selector en:

`apps/dental/lib/data-backend.ts`

Puntos clave:

- `DEFAULT_BACKEND` es `supabase`.
- `shouldReturnConvexData()` solo devuelve Convex cuando `DATA_READ_BACKEND=convex`.
- `shouldWriteConvexData()` cubre `DATA_WRITE_MODE=dual` o `convex`.
- `shouldWriteSupabaseData()` mantiene Supabase activo en `supabase` o `dual`.

Esto permite probar Convex sin cortar Supabase.

### 2. Runtime mirror

Existe mirror en:

`apps/dental/lib/convex/supabase-runtime-mirror.ts`

Cubre tablas principales como:

- `workspaces`
- `clinics`
- `workspace_users`
- `workspace_members`
- `clinic_users`
- `invitations`
- `user_settings`
- `categories`
- `patient_sources`
- `settings_time`
- `fixed_costs`
- `assets`
- `supplies`
- `services`
- `service_supplies`
- `patients`
- `treatments`
- `expenses`
- `ai_chat_sessions`
- `ai_chat_messages`
- `workspace_activity`
- `clinic_snapshots`
- `role_permissions`
- `inbox_conversations`
- `inbox_messages`
- `organizations`

Tambien replica usuario de Supabase Auth hacia `supabase_auth_users`, pero esto no significa que Auth ya este migrado.

### 3. Outbox SQL instalado

La migracion `supabase/migrations/82_convex_mirror_outbox.sql` fue aplicada en Supabase production y los triggers quedaron instalados en tablas existentes. Esto cubre escrituras directas a Supabase fuera de la app Next, siempre que el endpoint de sync procese la cola.

### 4. Rutas con lectura Convex parcial

Hay rutas con selector o helpers Convex para dominios centrales:

- assets
- categories
- dashboard
- expenses
- fixed-costs
- patient-sources
- patients
- services
- service_supplies
- settings/time
- supplies
- treatments
- payments/refunds de treatments
- snapshots storage con dual-write parcial

Esto es un avance real, pero no cubre toda la aplicacion.

## Bloqueos para apagar Supabase

### Bloqueo 1: Auth sigue en Supabase

Hay 69 archivos actuales con superficie Auth Supabase en `app/lib/hooks/middleware`, y la auditoria amplia habia marcado 73 superficies incluyendo mas contexto.

Ejemplos:

- `apps/dental/hooks/use-auth.ts`
- `apps/dental/middleware.ts`
- `apps/dental/app/auth/callback/route.ts`
- `apps/dental/app/auth/logout/route.ts`
- `apps/dental/app/auth/reset-password/page.tsx`
- `apps/dental/app/settings/security/SecuritySettingsClient.tsx`
- `apps/dental/app/api/onboarding/route.ts`
- `apps/dental/app/api/auth/delete-account/route.ts`
- multiples APIs con `supabase.auth.getUser()` o `supabase.auth.getSession()`

Mientras esto exista, apagar Supabase rompe login, sesiones, reset de password, MFA, seguridad, onboarding y permisos dependientes del usuario.

### Bloqueo 2: Produccion lee desde Supabase

`DATA_READ_BACKEND=supabase` significa que aunque Convex reciba escrituras, el frontend/API no esta usando Convex como fuente de verdad para lectura.

Esto es intencional para no romper usuarios, pero impide cancelar Supabase.

### Bloqueo 3: 127 lecturas siguen Supabase-only o no seleccionadas por backend

Ejemplos de areas con lecturas Supabase pendientes:

- AI chat/history/sessions/feedback/query
- analytics avanzados
- workspaces
- clinics
- invitations
- team members
- permissions
- onboarding
- setup/reset
- export/import
- snapshots discovery/restore
- booking publico
- marketing
- medications/prescriptions
- notifications
- WhatsApp/SMS/email support data

Estas rutas necesitan version Convex o capa de datos comun antes de cambiar `DATA_READ_BACKEND=convex`.

### Bloqueo 4: RPC sigue en Supabase

RPCs detectados:

- `user_has_clinic_access`
- `check_user_permission`
- `discover_clinic_tables`
- `get_table_columns`
- `get_table_foreign_keys`
- `process_recurring_expenses`
- `check_booking_slot_availability`

Convex no reemplaza automaticamente RPC SQL. Cada RPC debe reimplementarse como query/mutation/action de Convex o como logica server-side TypeScript.

Archivos con RPC:

- `apps/dental/lib/auth/verify-clinic-access.ts`
- `apps/dental/lib/clinic.ts`
- `apps/dental/lib/snapshots/discovery.ts`
- `apps/dental/lib/permissions/check.ts`
- `apps/dental/app/api/permissions/my/route.ts`
- `apps/dental/app/api/permissions/check/route.ts`
- `apps/dental/app/api/cron/recurring-expenses/route.ts`
- `apps/dental/app/api/clinics/route.ts`
- `apps/dental/app/api/team/clinic-members/route.ts`
- `apps/dental/app/api/public/book/route.ts`
- `apps/dental/lib/convex/supabase-runtime-mirror.ts` solo intercepta RPC para mirror, no reemplaza la logica SQL.

### Bloqueo 5: Realtime de Inbox sigue en Supabase

Archivo:

`apps/dental/app/inbox/InboxClient.tsx`

Usa:

- `.channel(...)`
- `postgres_changes`

Esto debe cambiarse a suscripciones Convex o polling controlado antes de apagar Supabase.

### Bloqueo 6: Storage no esta completamente migrado

Archivo principal:

`apps/dental/lib/snapshots/storage.ts`

Estado:

- Upload/delete de snapshots tiene dual-write hacia Convex Storage.
- Download/list/restore siguen leyendo desde Supabase Storage.

Mientras snapshot restore/export/download dependan de Supabase Storage, apagar Supabase puede romper backups.

### Bloqueo 7: Paridad Convex aun no es perfecta

Comparacion all-table registrada previamente:

- `supabaseRows=2305`
- `inserted=0`
- `updated=2`
- `unchanged=2303`
- `deleted=0`
- compare final con 3 issues

Issues:

- `clinics`: Convex tenia campos extra historicos (`booking_config`, `slug`) que ya no existen en Supabase.
- `workspaces`: Convex tenia campos extra historicos (`archived_at`, `delete_after`, `deleted_at`, `pending_deletion_at`, `setup_completed_at`, `setup_last_seen_at`, `setup_started_at`, `status`) que ya no existen en Supabase.
- `user_settings`: tabla sin `id`, el comparador usa `legacyId` y genera un caso falso/inestable.

Comparacion productiva actual completa:

```text
compare_ok=False
compare_tables=57
bad_tables=15
```

Tablas con problemas actuales reportados por `convex-compare`:

| Tabla | Lectura del issue |
| --- | --- |
| `workspaces` | Conteo igual, contenido diferente. |
| `clinics` | Conteo igual, contenido diferente. |
| `user_settings` | Tabla sin `id`; la clave legacy actual es inestable para comparar. |
| `chat_sessions` | Declarada en codigo, no existe en Supabase production. |
| `chat_messages` | Declarada en codigo, no existe en Supabase production. |
| `ai_feedback` | Declarada en codigo, no existe en Supabase production. |
| `public_bookings` | Declarada en codigo, no existe en Supabase production. |
| `public_booking_services` | Declarada en codigo, no existe en Supabase production. |
| `booking_blocked_slots` | Declarada en codigo, no existe en Supabase production. |
| `quotes` | Declarada en codigo, no existe en Supabase production. |
| `quote_items` | Declarada en codigo, no existe en Supabase production. |
| `notification_retry_queue` | Declarada en codigo, no existe en Supabase production. |
| `whatsapp_notifications` | Declarada en codigo, no existe en Supabase production. |
| `whatsapp_templates` | Declarada en codigo, no existe en Supabase production. |
| `action_logs` | Declarada en codigo, no existe en Supabase production. |

Causa tecnica:

En `apps/dental/convex/migration.ts`, `replaceTableSnapshot` usa `ctx.db.patch(existing._id, row)`. Eso actualiza campos presentes, pero no elimina campos viejos de Convex que ya no existen en Supabase.

Para una sincronizacion exacta, el full-sync debe reemplazar el documento o limpiar campos obsoletos.

### Bloqueo 8: El secreto Convex de mutations no esta probado en production

`apps/dental/lib/convex/server.ts` exige `CONVEX_AUTH_BRIDGE_SECRET` para:

- `getConvexAuthContext`
- `convexUserHasPermission`
- `upsertConvexDocumentByLegacyId`
- `replaceConvexTableSnapshot`
- `patchConvexDocumentByLegacyId`
- `deleteConvexDocumentByLegacyId`
- `uploadConvexStorageObject`
- `deleteConvexStorageObject`

La verificacion de Vercel mostro:

- `vercel env ls`: `CONVEX_AUTH_BRIDGE_SECRET` existe como `Encrypted`.
- `vercel env pull --environment=production`: valor con longitud `0`.

Antes de confiar en dual-write production hacia Convex, hay que confirmar si ese valor esta realmente vacio o si Vercel lo oculta al pull. Si esta vacio, el dual-write directo a Convex falla en runtime cuando la ruta intenta llamar esos helpers.

## Proximo paso correcto

El proximo paso concreto para dejar de necesitar Supabase es:

1. Corregir/verificar `CONVEX_AUTH_BRIDGE_SECRET` en production y preview.
2. Corregir la sincronizacion exacta de Convex.
3. Reejecutar full-sync de todas las tablas reales.
4. Separar en el allowlist las tablas que no existen en Supabase production.
5. Dejar `convex-compare` en verde para todas las tablas reales.
6. Crear preview con `DATA_READ_BACKEND=convex` y `DATA_WRITE_MODE=dual`.
7. Arreglar rutas que fallen porque todavia leen Supabase-only.
8. Solo despues migrar Auth, Storage, Realtime y RPC.

No conviene empezar por Auth. Auth es el corte mas riesgoso. Primero hay que demostrar que los datos y las pantallas funcionan igual con Convex leyendo.

## Orden recomendado de trabajo

### Fase 1: Paridad exacta de datos

Cambios:

- Confirmar o recrear `CONVEX_AUTH_BRIDGE_SECRET` en Vercel production/preview antes de ejecutar mutations Convex desde Next.
- En `apps/dental/convex/migration.ts`, hacer que `replaceTableSnapshot` reemplace documentos existentes en lugar de solo parchearlos.
- Definir IDs legacy estables para tablas sin `id`, empezando por `user_settings` con una clave compuesta como `user_id:key`.
- Ajustar `convex-compare` para usar la misma estrategia de legacy ID.
- Ajustar `convex-compare` para no tratar como fallo las tablas ausentes que el full-sync ya reconoce como `missingInSupabase`, o eliminar esas tablas del allowlist si no pertenecen al esquema actual.

Validacion:

- Ejecutar full-sync completo.
- Ejecutar compare completo.
- Resultado esperado: `ok=true`, `issueCount=0`.

### Fase 2: Preview Convex-read

Configurar solo preview/staging:

- `DATA_READ_BACKEND=convex`
- `DATA_WRITE_MODE=dual`
- `CONVEX_RUNTIME_MIRROR_STRICT=0`

No cambiar produccion todavia.

Validar:

- login con Supabase Auth
- dashboard
- pacientes
- tratamientos
- pagos/refunds
- servicios
- insumos
- gastos
- categorias
- fuentes de pacientes
- reportes basicos
- snapshots basicos

### Fase 3: Completar lecturas faltantes

Convertir por modulo, no de golpe:

1. workspaces/clinics/access
2. permissions/team/invitations
3. analytics/reportes
4. AI chat/history/sessions
5. onboarding/setup/reset
6. export/import/snapshots
7. booking publico
8. marketing/prescriptions/notifications
9. inbox

Cada modulo debe tener:

- lectura Supabase
- lectura Convex
- selector por env
- prueba de comparacion
- rollback por env

### Fase 4: Reemplazar RPC

Reimplementar:

- `user_has_clinic_access`
- `check_user_permission`
- `process_recurring_expenses`
- `check_booking_slot_availability`

Para `discover_clinic_tables`, `get_table_columns` y `get_table_foreign_keys`, conviene decidir si snapshots seguiran soportando inspeccion SQL o si se reemplaza por manifest/schema fijo.

### Fase 5: Realtime y Storage

Realtime:

- Reemplazar Inbox Supabase Realtime por Convex subscriptions o polling controlado.

Storage:

- Opcion segura: dejar archivos en Supabase/otro storage hasta el final.
- Opcion Convex: migrar snapshots, generar URLs/descargas desde Convex y probar restore.

### Fase 6: Auth

Migrar Auth al final o en una rama/preview dedicada.

Trabajo necesario:

- login
- signup
- reset password
- email verification
- MFA
- force logout
- delete account
- session middleware
- permisos por usuario
- user metadata
- bridge de IDs de usuario

### Fase 7: Produccion Convex-read

Solo cuando preview este limpio:

- poner `DATA_READ_BACKEND=convex` en production
- mantener `DATA_WRITE_MODE=dual`
- mantener Supabase vivo como rollback

Observar por al menos una ventana corta de uso real.

### Fase 8: Supabase readonly / apagado gradual

Antes de cancelar Supabase:

- confirmar que la app funciona sin `NEXT_PUBLIC_SUPABASE_URL`
- confirmar que no se usa `SUPABASE_SERVICE_ROLE_KEY`
- confirmar que no se usa `SUPABASE_DB_URL`
- confirmar que Auth no depende de Supabase
- confirmar que Storage no depende de Supabase
- confirmar que RPC no depende de Supabase
- correr busqueda repo: `rg "supabase|@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_"`
- correr regresion completa

Solo despues de eso se puede cancelar Supabase.

## Criterio de salida para cancelar Supabase

Supabase se puede cancelar cuando se cumplan todos estos puntos:

- Produccion lee desde Convex.
- Produccion escribe solo en Convex o dual-write ya no necesita Supabase.
- Auth ya no usa Supabase.
- Storage critico ya no usa Supabase.
- Realtime ya no usa Supabase.
- RPC SQL ya no existe o fue reemplazado.
- `convex-compare` esta verde antes del corte final.
- No hay variables Supabase necesarias para arrancar la app.
- Existe backup exportado de Supabase guardado fuera de Supabase.
- Existe rollback funcional o snapshot restaurable.

Hoy no estamos en ese punto.

## Primera tarea concreta

La primera tarea tecnica debe ser:

Corregir la base de confianza del puente Convex:

- confirmar/recrear `CONVEX_AUTH_BRIDGE_SECRET`: pendiente antes de desplegar/operar production
- reemplazo exacto en `replaceTableSnapshot`: hecho localmente
- legacy IDs estables para tablas sin `id`: hecho localmente para `user_settings`
- compare usando la misma clave: hecho localmente
- allowlist alineado con tablas reales: parcialmente hecho; compare ya no debe fallar solo por tabla ausente
- full-sync completo: pendiente despues de desplegar esta version
- compare completo en verde: pendiente despues de desplegar esta version y ejecutar full-sync

Esto es lo mas importante porque antes de mover lecturas a Convex necesitamos saber que Convex representa exactamente los datos actuales.

## Respuesta directa a "como hacemos para que ya no necesitemos Supabase"

No se hace apagandolo ahora. Se hace creando una ruta de eliminacion con checkpoints:

1. Convex igual a Supabase.
2. Preview leyendo desde Convex.
3. Produccion leyendo desde Convex, todavia dual-write.
4. Auth fuera de Supabase.
5. Storage/Realtime/RPC fuera de Supabase.
6. App arrancando sin variables Supabase.
7. Backup final.
8. Cancelacion.

El siguiente cambio de codigo recomendado es pequeno y seguro: arreglar el full-sync/compare para que Convex quede identico a Supabase. Despues de eso se puede empezar a cambiar modulos de lectura a Convex con feature flag.
