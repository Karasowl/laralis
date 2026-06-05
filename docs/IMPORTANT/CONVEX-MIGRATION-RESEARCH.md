# Laralis: investigacion para migrar Supabase a Convex sin romper produccion

## LEER PRIMERO - estado operativo actual al cierre de la migracion paralela

Actualizacion posterior - 2026-05-31 19:55 America/Mexico_City:

- Se migro la credencial Convex de la cuenta real indicada por el usuario.
- Coincidencia encontrada: una sola cuenta Supabase Auth con identificador
  `conladoctoralara` (`co***@gmail.com`).
- Se creo y consumio un reset Convex con la password indicada.
- Produccion dual:
  - `POST /api/auth/convex-password-reset/complete` respondio `200`.
  - `POST /api/auth/convex-login` respondio `200`.
  - `GET /api/auth/me` con cookie Convex respondio `200`.
- Se consumio tambien el reset Convex anterior de esa misma cuenta para no
  dejar un token reutilizable activo.
- Verificacion final posterior: login Convex `200`, `/api/auth/me` `200`.
- Health production:
  - `passwordCredentials=1`.
  - `migratedAuthUsers=3`.
  - `AUTH_BACKEND=dual`.
  - `DATA_READ_BACKEND=supabase`.
  - `DATA_WRITE_MODE=dual`.
- Compare production de 57 tablas sigue `ok=true`.
- Canary Convex-only con esa misma cuenta:
  - login `200`.
  - `/api/auth/me` `200`.
  - `/api/workspaces?list=true` `200`, `workspaceCount=1`.
  - `/api/clinics` `200`, `clinicCount=1`.
  - `/` despues de login `200`.

Lectura correcta:

- Ya existe una cuenta real funcional con Auth Convex.
- Esto desbloquea pruebas autenticadas reales sin Supabase Auth.
- Produccion sigue en dual seguro; no se cancelo Supabase ni se cambio la
  lectura visible de produccion.
- El siguiente paso para dejar de necesitar Supabase es probar CRUD principal
  con esta cuenta en Convex-only y luego preparar el cambio de env de produccion.

Actualizacion posterior - 2026-05-31 17:58 America/Mexico_City:

- Produccion fue desplegada con build de produccion en modo seguro:
  `https://laralis.vercel.app`.
- No se promovio el canary Convex-only porque ese artefacto tenia env publicas
  de preview.
- Produccion queda en:
  - `AUTH_BACKEND=dual`.
  - `NEXT_PUBLIC_AUTH_BACKEND=dual`.
  - `DATA_READ_BACKEND=supabase`.
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
  - `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Resultado: para la usuaria la app sigue leyendo/Auth por Supabase, pero las
  escrituras runtime de la app ya quedan preparadas para Supabase + Convex.
- Health production: `ok=true`.
- Compare production de 57 tablas: `ok=true`, `badCompareTables=0`.
- Se corrigio `/api/cron/retry-notifications` para no fallar si
  `notification_retry_queue` no existe; ahora responde `200` no-op.
- Logs production posteriores al hotfix: sin errores en la ventana revisada.
- Se generaron 3 enlaces de reset Convex de produccion para cuentas migradas,
  guardados localmente en:
  `tmp/convex-production-verification/convex-reset-links-production-20260531T235537Z.json`.
- Los enlaces vencen el 2026-06-01T23:55Z y fueron verificados con `200` sin
  consumirlos.

Lectura correcta:

- Supabase no se cancela ahora.
- La app real ya esta en la fase de convivencia: Supabase visible como fuente
  segura, Convex en paralelo y comparado.
- Falta que las cuentas creen credencial Convex:
  `migratedAuthUsers=3`, `passwordCredentials=0`.
- Cuando las 3 cuentas completen reset/login y `passwordCredentials=3`, el
  siguiente corte tecnico es probar `AUTH_BACKEND=convex` con usuario real.

Actualizacion posterior - 2026-05-31 17:46 America/Mexico_City:

- Se agrego `GET /api/auth/me` para resolver usuario actual desde Supabase o
  Convex segun el backend activo.
- `WorkspaceProvider` dejo de depender de `supabase.auth.getUser()` para la
  carga inicial y `refreshUser`.
- `WorkspaceProvider` dejo de leer `clinics` directo desde Supabase; ahora usa
  `/api/clinics?workspaceId=...`, que ya soporta `DATA_READ_BACKEND=convex`.
- En modo `AUTH_BACKEND=convex`, el frontend no crea cliente Supabase para
  escuchar cambios de Auth.
- Preview canary nuevo:
  `https://laralis-lsoqqazxf-avanxia-labs.vercel.app`.
- Flags verificadas:
  - `AUTH_BACKEND=convex`.
  - `NEXT_PUBLIC_AUTH_BACKEND=convex`.
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
- Health canary: `ok=true`.
- Compare completo canary de 57 tablas: `ok=true`, `badCompareTables=0`.
- Verificacion sin sesion:
  - `/auth/login` responde `200`.
  - `/api/auth/me` responde `401`.
  - `/` redirige a `/auth/login?redirectTo=%2F`.
- Build local y auditoria dual-write pasan.

Lectura correcta:

- El problema de datos esta cerrado para este canary: Supabase y Convex
  comparan igual en las 57 tablas.
- El problema inmediato para dejar de necesitar Supabase es Auth:
  `migratedAuthUsers=3`, `passwordCredentials=0`.
- Siguiente paso exacto: crear una credencial de password Convex para una
  cuenta real migrada, probar login Convex en preview, y repetir hasta que
  `passwordCredentials >= migratedAuthUsers`.
- No cancelar Supabase ni pasar produccion a Convex-only hasta que ese login
  real y los flujos privados esten verificados.

Actualizacion posterior - 2026-05-31 17:37 America/Mexico_City:

- Se adapto el middleware para soportar `AUTH_BACKEND=convex` sin crear cliente
  Supabase.
- `/auth/convex-reset-password` ya es ruta publica del middleware.
- `/auth/logout` limpia cookies aunque Supabase no este configurado.
- Preview canary Convex-only:
  `https://laralis-cdup8sre2-avanxia-labs.vercel.app`.
- Flags verificadas:
  - `AUTH_BACKEND=convex`.
  - `NEXT_PUBLIC_AUTH_BACKEND=convex`.
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
- Health canary: `ok=true`.
- Compare completo canary de 57 tablas: `ok=true`, `badCompareTables=0`.
- Verificacion de rutas sin sesion:
  - `/auth/login` responde `200`.
  - `/auth/convex-reset-password` responde `200`.
  - `/auth/logout` redirige a `/auth/login`.
  - `/` redirige a `/auth/login?redirectTo=%2F`.

Lectura correcta:

- El canary ya prueba el shell Convex-only de Auth/middleware.
- Aun no prueba login real Convex porque no hay password Convex capturada:
  `passwordCredentials=0`.
- El siguiente salto requiere crear una credencial con login/reset real, luego
  autenticar en el canary y recorrer flujos privados.

Actualizacion posterior - 2026-05-31 17:31 America/Mexico_City:

- Se conecto tambien `/auth/reset-password` al bridge Convex.
- Si una cuenta cambia password por el flujo actual de Supabase y
  `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`, Laralis intenta guardar esa nueva
  credencial en Convex.
- Preview canary nuevo:
  `https://laralis-qhy5k1qa4-avanxia-labs.vercel.app`.
- Health canary verificado:
  - `ok=true`.
  - `convexHost=superb-grouse-940.convex.cloud`.
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
  - `AUTH_BACKEND=dual`.
- `/auth/reset-password` y `/auth/convex-reset-password` responden `200`.
- `passwordCredentials=0` sigue siendo el bloqueo hasta que una cuenta real
  complete login/reset y cree su credencial Convex.

Actualizacion posterior - 2026-05-31 17:26 America/Mexico_City:

- Se agrego una ruta de bootstrap/reset de password Convex para salir de
  Supabase Auth sin conocer passwords anteriores.
- Endpoints nuevos:
  - `POST /api/auth/convex-password-reset/request`, protegido por
    `CRON_SECRET`.
  - `GET /api/auth/convex-password-reset/verify`.
  - `POST /api/auth/convex-password-reset/complete`.
- Pagina nueva: `/auth/convex-reset-password`.
- El token de reset se almacena en Convex como hash SHA-256 y se consume una
  sola vez.
- Al completar el reset se crea/actualiza `auth_password_credentials` y se
  establece una sesion Convex.
- Convex production fue desplegado con estas funciones:
  `https://superb-grouse-940.convex.cloud`.
- Preview canary nuevo:
  `https://laralis-4ms6si6dh-avanxia-labs.vercel.app`.
- Verificaciones:
  - Build local pasa.
  - Auditoria dual-write pasa con `highRisk=0`, `manualReview=0`.
  - Health canary pasa con `DATA_READ_BACKEND=convex`,
    `DATA_WRITE_MODE=dual`, `AUTH_BACKEND=dual`.
  - Compare completo canary de 57 tablas pasa con `badCompareTables=0`.
  - La pagina de reset Convex responde `200`.
  - La request de reset sin secreto responde `401`.
  - La request de reset para email inexistente responde `400`.

Lectura correcta:

- Ya existe una salida operativa para migrar la password de una cuenta real a
  Convex sin cancelar Supabase.
- Todavia no se debe cambiar produccion a `AUTH_BACKEND=convex` porque
  `passwordCredentials=0`.
- Para avanzar hay que generar un enlace de reset Convex para la cuenta real,
  completar el reset, verificar que `passwordCredentials` suba y luego probar
  un preview con `AUTH_BACKEND=convex`.

Actualizacion posterior - 2026-05-31 17:17 America/Mexico_City:

- Produccion sigue activa en `https://laralis.vercel.app`.
- Supabase sigue vivo y sigue como lectura principal/Auth de produccion; no se
  cancelo ni se borro.
- Se creo un preview canary protegido:
  `https://laralis-bxtwa77ne-avanxia-labs.vercel.app`.
- Ese preview canary ya usa Convex production correcto:
  `https://superb-grouse-940.convex.cloud`.
- Flags runtime verificadas en el canary:
  - `DATA_READ_BACKEND=convex`.
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
  - `AUTH_BACKEND=dual`.
  - `NEXT_PUBLIC_AUTH_BACKEND=dual`.
  - `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Health canary: `ok=true`, `mutationCheck=true`,
  `sessionSecretConfigured=true`.
- Compare completo canary de 57 tablas: `ok=true`, `badCompareTables=0`.
- Rutas privadas sin sesion (`/api/workspaces`, `/api/clinics`) devuelven
  `401`, como corresponde.
- Evidencia:
  - `tmp/convex-preview-verification/health-canary-20260531T171648Z.json`.
  - `tmp/convex-preview-verification/compare-canary-20260531T171648Z.json`.
  - `tmp/convex-preview-verification/compare-all-canary-20260531T171723Z.json`.

Bloqueo para Convex-only:

- Convex tiene usuarios Auth migrados (`migratedAuthUsers=3`), pero no tiene
  credenciales de password capturadas (`passwordCredentials=0`).
- `readyForConvexPasswordLogin=false`; por tanto Supabase Auth sigue siendo
  necesario para que la usuaria real pueda entrar.
- Para dejar de necesitar Supabase, el proximo paso es validar login en preview
  con el bridge activo, capturar credenciales o forzar reset seguro hacia
  Convex, y luego probar `AUTH_BACKEND=convex` en preview antes de tocar
  produccion.

Actualizacion posterior - 2026-05-31 16:34 America/Mexico_City:

- Produccion sigue activa en `https://laralis.vercel.app`.
- Supabase sigue vivo y sigue como Auth/lectura principal; no se cancelo.
- Vercel production ahora reporta Convex host `superb-grouse-940.convex.cloud`.
- Full sync production Supabase -> Convex: `ok=true`, `tables=57`,
  `failed=0`, `supabaseRows=2305`.
- Compare profundo production de 57 tablas: `ok=true`, `bad=0`,
  `issues=0`.
- Se corrigio el despliegue local para no subir `apps/**/.env*.local` a Vercel
  y se forzo `cache: no-store` en el cliente HTTP server-side de Convex.
- Esto cierra paridad de datos base, pero NO convierte la app en Convex-only.
  Para dejar de necesitar Supabase falta migrar o aislar Auth, Storage, RPC,
  Realtime y las lecturas/API que todavia no usan `DATA_READ_BACKEND=convex`.

Fecha de cierre operativo: 2026-05-31. Este bloque es el estado vigente y
supera las notas historicas mas abajo que decian que produccion no habia sido
tocada. La regla principal se mantuvo: Supabase no se borro, no se cancelo y
no se reemplazo como Auth.

Estado live:

- Produccion real: `https://laralis.vercel.app`.
- Proyecto Vercel correcto enlazado localmente: `avanxia-labs/laralis`.
- Deployment production verificado: `dpl_7mdahmB1fph5drmtEaRqvcE3jWeX`.
- Convex production: `https://superb-grouse-940.convex.cloud`.
- Produccion sigue leyendo desde Supabase: `DATA_READ_BACKEND=supabase`.
- Produccion escribe en doble via para los dominios migrados: `DATA_WRITE_MODE=dual`.
- Storage de snapshots escribe en doble via cuando pasa por el helper migrado:
  `DATA_WRITE_MODE_STORAGE=dual`.
- Full sync Supabase -> Convex esta activo: `CONVEX_FULL_SYNC_ENABLED=1`.
- Outbox SQL/eventos esta preparado, pero no instalado en Supabase produccion:
  `CONVEX_MIRROR_SYNC_ENABLED=0`.
- Auth sigue siendo Supabase Auth. Convex Auth/bridge existe, pero no es el
  mecanismo principal de produccion.

Datos ya migrados a Convex production:

- Export fresco de Supabase produccion:
  `tmp/supabase-production-export/supabase-export-20260531T093603Z/manifest.json`.
- Supabase ref: `julrghzzqdgdwqaongct`.
- Tablas exportadas por API: 44/56.
- Filas exportadas de tablas publicas: 2,302.
- Auth users exportados por admin API: 3.
- Storage `clinic-snapshots`: 183 archivos, 6,474,485 bytes.
- Manifest preparado para Convex:
  `tmp/supabase-production-export/supabase-export-20260531T093603Z/convex-import/manifest.json`.
- Import Convex production verificado: 45 tablas, 2,305 documentos.
- Storage Convex production verificado: 183 archivos, 6,474,485 bytes.

Evidencia local de import/verificacion:

- `tmp/convex-migration-audit/convex-import-sync-20260531T093720Z.json`.
- `tmp/convex-migration-audit/convex-import-verify-20260531T094216Z.json`.
- `tmp/convex-migration-audit/convex-storage-import-20260531T094224Z.json`.
- `tmp/convex-migration-audit/convex-storage-verify-20260531T094401Z.json`.

Estado de sincronizacion production:

- `convex-full-sync` production corrio correctamente despues del deploy final:
  `ok=true`, `failed=0`, `supabaseRows=2305`, `inserted=0`,
  `updated=2`, `unchanged=2303`, `deleted=0`.
- Los `updated=2` repetidos vienen de una comparacion estable en tablas chicas
  como `workspaces`/`clinics`; no indican perdida ni mismatch de conteos.
- Health production verificado con conteos iguales en tablas criticas:
  - `patients`: 246 / 246.
  - `treatments`: 430 / 430.
  - `services`: 27 / 27.
  - `supplies`: 75 / 75.
  - `expenses`: 122 / 122.
  - `clinic_snapshots`: 239 / 239.
  - `supabase_auth_users`: 3 en Convex.
- Verificacion final adicional despues de este documento:
  - `https://laralis.vercel.app/` responde `200`.
  - `vercel inspect laralis.vercel.app` reporta production `Ready` en
    `dpl_7mdahmB1fph5drmtEaRqvcE3jWeX`.
  - Health critico: `ok=true`.
  - Sync critico: `ok=true`, `failed=0`, `supabaseRows=1142`,
    `inserted=0`, `updated=0`, `unchanged=1142`, `deleted=0`.
- Se agrego un comparador profundo, read-only y protegido por `CRON_SECRET`:
  `GET /api/migration/convex-compare`. Compara Supabase contra Convex por
  `legacyId`, normaliza los campos codificados para Convex, ignora metadata
  Convex (`_id`, `_creationTime`, `convex_*`) y reporta muestras de filas
  faltantes o diferentes. Este endpoint es el gate correcto para validar
  "Supabase vs Convex devuelve lo mismo" antes de poner
  `DATA_READ_BACKEND=convex` en preview o production. Por seguridad solo
  acepta tablas en la allowlist de tablas migradas conocidas.
- Se agrego una auditoria estatica read-only de cobertura dual-write:
  `apps/dental/scripts/migration/audit-dual-write-coverage.mjs`. Escanea
  `apps/dental/app` y `apps/dental/lib` para detectar escrituras Supabase que
  no parezcan pasar por clientes espejados. Ultimo pase local estricto:
  `ok=true`, `highRisk=0`, `manualReview=0`, evidencia en
  `tmp/convex-migration-audit/dual-write-coverage-20260531T204643Z.json`.
  Los falsos positivos anteriores quedaron cerrados envolviendo clientes
  inyectados en AI actions, import/export, snapshots y MFA, y ensenando a la
  auditoria a reconocer imports relativos como `./supabaseAdmin`.
- Logs de production mostraron un error no relacionado con Convex:
  `/api/cron/retry-notifications` falla porque Supabase production no tiene
  `public.notification_retry_queue` en schema cache. Esto ya estaba fuera del
  alcance de la migracion y debe tratarse como deuda aparte.

Preview para comparar frontend leyendo Convex:

- URL protegida de preview:
  `https://laralis-1ldityomp-avanxia-labs.vercel.app`.
- Share URL temporal:
  `https://laralis-1ldityomp-avanxia-labs.vercel.app/?_vercel_share=jFsm1GoIOnXuUpplJtmGRF7QlLjaVJFa`.
- Expira el 2026-06-01 09:09:15.
- Ese preview usa `DATA_READ_BACKEND=convex` y escribe solo Supabase para no
  contaminar pruebas: `DATA_WRITE_MODE=supabase`,
  `DATA_WRITE_MODE_STORAGE=supabase`.

Proyecto incorrecto corregido:

- Primero se habia tocado `avanxia-labs/laralis-monorepo-preview`, que no era
  la produccion real.
- Ese proyecto quedo desactivado para sync/escritura Convex:
  `DATA_WRITE_MODE=supabase`, `DATA_WRITE_MODE_STORAGE=supabase`,
  `CONVEX_FULL_SYNC_ENABLED=0`, `CONVEX_MIRROR_SYNC_ENABLED=0`.
- El repo local fue relinkeado de vuelta al proyecto correcto `laralis`.

Rollback inmediato:

1. En Vercel production de `laralis`, poner:
   - `DATA_WRITE_MODE=supabase`.
   - `DATA_WRITE_MODE_STORAGE=supabase`.
   - `CONVEX_FULL_SYNC_ENABLED=0`.
   - `CONVEX_MIRROR_SYNC_ENABLED=0`.
   - Mantener `DATA_READ_BACKEND=supabase`.
2. Redeploy production.
3. Supabase seguiria siendo Auth, lectura y escritura principal; no hace falta
   restaurar datos para volver atras porque Supabase nunca dejo de ser fuente
   primaria de lectura.

Pendientes antes de cancelar o borrar cualquier cosa de Supabase:

- No cancelar Supabase todavia. La app sigue usando Supabase Auth.
- Se agrego una segunda red de seguridad runtime:
  `apps/dental/lib/convex/supabase-runtime-mirror.ts` envuelve
  `supabaseAdmin` desde `apps/dental/lib/supabaseAdmin.ts` y tambien el cliente
  SSR de `apps/dental/lib/supabase/server.ts`. Con `DATA_WRITE_MODE=dual`,
  cualquier `.insert/.upsert/.update/.delete` server-side contra tablas
  migradas intenta reflejarse a Convex. Si la respuesta de Supabase trae filas
  con `id`, hace upsert/delete por `legacyId`; si no trae filas suficientes,
  reemplaza el snapshot completo de esa tabla desde Supabase. Tambien refresca
  `expenses` cuando termina el RPC `process_recurring_expenses`, y mantiene
  `supabase_auth_users` en Convex cuando server-side Auth hace
  `updateUser/createUser/updateUserById/inviteUserByEmail/deleteUser`. Por
  defecto una falla Convex no rompe el flujo de usuario;
  `CONVEX_RUNTIME_MIRROR_STRICT=1` lo vuelve estricto.
- El wrapper runtime ahora es idempotente: si un helper recibe un cliente que
  ya estaba espejado, no lo envuelve dos veces. Esto permite que helpers con
  clientes inyectados se protejan localmente sin duplicar escrituras Convex.
- Helpers endurecidos para dual-write aunque reciban un cliente Supabase
  inyectado: `apps/dental/lib/ai/service.ts`,
  `apps/dental/lib/ai/actions/pricing-actions.ts`,
  `apps/dental/lib/ai/actions/operational-actions.ts`,
  `apps/dental/lib/export/importer.ts`,
  `apps/dental/lib/snapshots/exporter.ts`,
  `apps/dental/lib/snapshots/importer.ts`,
  `apps/dental/lib/snapshots/storage.ts` y
  `apps/dental/lib/security/mfa-preferences.ts`.
- `supabase_auth_users` queda incluido en la allowlist del runtime mirror para
  que los cambios Auth server-side no se salten el espejo hacia Convex.
- El fallback de snapshot completo usa un cliente service-role crudo creado
  dentro de `supabase-runtime-mirror.ts`; no usa el cliente SSR con RLS del
  usuario. Si no existe `SUPABASE_SERVICE_ROLE_KEY`, ese fallback falla de
  forma no estricta y queda cubierto por el full-sync programado.
- Se agrego `apps/dental/app/api/auth/convex-sync-user/route.ts` y el browser
  client `apps/dental/lib/supabase/client.ts` lo llama despues de
  `signInWithPassword`, `signUp`, `updateUser`, `setSession`,
  `exchangeCodeForSession`, `verifyOtp` y `signInWithOtp`. Esto cubre cambios
  de Auth hechos desde pantallas cliente como perfil, idioma, seguridad y reset.
- El runtime mirror server-side tambien reconoce resultados Auth con
  `data.session.user`, ademas de `data.user`, para reflejar callbacks/sesiones
  hacia `supabase_auth_users`.
- Auditoria local de accesos directos: los archivos que crean
  `createServerClient` directo se usan para auth/session; el unico archivo con
  `.from/.rpc` ademas de `createServerClient` fue `app/api/clinics/route.ts`,
  y sus escrituras reales pasan por `supabaseAdmin` o por `createClient()` de
  `lib/supabase/server.ts`, ambos cubiertos por el runtime mirror.
- El nuevo endpoint `apps/dental/app/api/migration/convex-compare/route.ts`
  permite verificar igualdad por contenido, no solo por conteos. Uso sugerido:
  `GET /api/migration/convex-compare?tables=patients,treatments,services,supplies,expenses`
  con header `Authorization: Bearer <CRON_SECRET>`.
- El requisito mas fuerte "cada escritura en Supabase emite evento inmediato
  aun si ocurre fuera de la app Next" todavia requiere instalar el outbox SQL.
  Desde este entorno no se pudo instalar porque Vercel production solo tiene
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
  `SUPABASE_SERVICE_ROLE_KEY`, el repo no esta linkeado a Supabase CLI, y
  Bitwarden no expuso Postgres URL, DB password ni Supabase access token util
  para DDL.
- Instalar el outbox SQL en Supabase solo cuando se tenga acceso SQL directo y
  despues de probarlo en stage:
  `supabase/migrations/82_convex_mirror_outbox.sql`.
- Mantener el full sync como red de seguridad mientras el outbox esta apagado.
- Probar manualmente el preview Convex-read con login real: dashboard,
  pacientes, tratamientos, servicios, insumos, gastos, snapshots y reportes.
- Confirmar que las rutas no migradas o con service-role siguen sin depender
  de Convex para produccion.
- Resolver el problema preexistente de `notification_retry_queue` ausente si se
  quieren limpiar logs de cron no relacionados con esta migracion.
- Considerar rotar secretos despues de estabilizar, porque durante la operacion
  se manipularon secretos en CLI/entorno local aunque no deben quedar en git.
- Verificacion local posterior de la capa runtime:
  `next build` paso usando el runtime Node empaquetado de Codex. El comando
  equivalente fue ejecutar `node node_modules/next/dist/bin/next build` desde
  `apps/dental`.
- Pruebas locales focalizadas del runtime mirror pasaron con un runner Node
  aislado que transpila `supabase-runtime-mirror.ts` y mockea Supabase/Convex:
  upsert por `legacyId`, delete por `legacyId`, fallback full-table con
  service-role, fallo Convex no estricto sin romper Supabase y sync Auth hacia
  `supabase_auth_users`. Se agrego una verificacion posterior para resultados
  Auth tipo `data.session.user` y para confirmar que metodos Supabase no
  interceptados quedan binded al cliente original.
- `next build` volvio a pasar despues de agregar
  `/api/migration/convex-compare`.
- `tsc -p apps/dental/tsconfig.json --noEmit --pretty false` sigue fallando
  globalmente por deuda previa, pero el filtro sobre los archivos nuevos de
  migracion reporto `NO_NEW_MIGRATION_TYPE_ERRORS_FOUND`.
- Se agrego `apps/dental/lib/convex/supabase-runtime-mirror.test.ts` y
  `apps/dental/vitest.migration.config.mjs` para dejar el caso listo para
  Vitest, pero en este sandbox Vitest no llego a ejecutar tests porque esbuild
  falla al cargar cualquier config con `Cannot read directory ... Access is
  denied`.
- `tsc -p apps/dental/tsconfig.json --noEmit --pretty false` sigue fallando
  por deuda preexistente amplia del repo; al filtrar la salida no aparecieron
  errores en los nuevos archivos de mirror/runtime.
- Verificacion local posterior al endurecimiento de helpers inyectados:
  `next build` paso completo desde `apps/dental`, la auditoria dual-write paso
  con `highRisk=0` y `manualReview=0`, y el filtro de `tsc` sobre archivos de
  migracion reporto `NO_NEW_MIGRATION_TYPE_ERRORS_FOUND`.
- No se pudo crear un nuevo deploy desde este sandbox: no hay Vercel CLI
  disponible localmente, no hay `npm/npx` en PATH, y el conector Vercel de esta
  sesion solo devolvio la instruccion de usar `vercel deploy`.
- Reintento posterior de deploy con el MCP de Vercel tambien devolvio solo la
  instruccion `vercel deploy`. Verificacion local: `vercel` no esta en PATH,
  `node_modules/.bin/vercel.cmd` no existe y `node_modules/vercel/package.json`
  no existe. Proyecto local sigue enlazado a `avanxia-labs/laralis`:
  `prj_a1vNLl8sk5iIK8i5CH9s4mzCwQjh`.
- Actualizacion posterior: con token temporal de Vercel proporcionado por el
  usuario, el deploy production si se completo. Nuevo deployment:
  `dpl_9znbTxD8zPD6WyAogKVu8rhaZMvE`,
  `https://laralis-bkypxxwek-avanxia-labs.vercel.app`, alias production
  `https://laralis.vercel.app`, estado `Ready`.
- Segunda actualizacion posterior: se habilito
  `CONVEX_MIRROR_SYNC_ENABLED=1` en Vercel production mediante API para evitar
  espacios/saltos de linea de la CLI, y se redeployo production. Deployment
  vigente: `dpl_CD9nKRkquzJ5FzRF6NTxKsw5PvzA`,
  `https://laralis-5iogzlaci-avanxia-labs.vercel.app`, alias
  `https://laralis.vercel.app`, estado `Ready`.
- Verificacion posterior al deploy:
  - `https://laralis.vercel.app/` respondio `200`.
  - `vercel inspect laralis.vercel.app` reporto production `Ready` en el
    deployment vigente `dpl_CD9nKRkquzJ5FzRF6NTxKsw5PvzA`.
  - `convex-sync` ya esta habilitado, pero reporta `queueInstalled=false`
    hasta que se ejecute correctamente el SQL outbox en Supabase Dashboard.
  - `convex-health` critico: `ok=true`.
  - `convex-full-sync` critico: `ok=true`, `failed=0`, `supabaseRows=1142`,
    `inserted=0`, `updated=0`, `unchanged=1142`, `deleted=0`.
  - `convex-compare` critico: `ok=true` y `issueCount=0` para `patients`,
    `treatments`, `services`, `supplies`, `expenses`, `clinic_snapshots` y
    `supabase_auth_users`.
- Token Vercel: no quedo escrito en archivos del repo segun busqueda local.
  Debe revocarse/rotarse despues de cerrar esta ventana operativa.
- Intento de SQL outbox en Supabase Dashboard fallo por pegado parcial: el
  error empezo en `as $$` de `convex_mirror_table_names()` y el texto pegado se
  corto alrededor de `clinic_google_calendar`. La migracion local esta completa;
  hay que volver a ejecutarla completa desde `supabase/migrations/82_convex_mirror_outbox.sql`
  y luego correr `select * from public.install_convex_mirror_triggers();`.
- Actualizacion posterior: con password de base de datos proporcionado por el
  usuario, se aplico la migracion SQL outbox directamente via `psql` contra
  `db.julrghzzqdgdwqaongct.supabase.co`. Resultado:
  `convex_mirror_events` creado, funciones creadas y triggers instalados en
  las tablas existentes. Las tablas inexistentes fueron omitidas por el helper
  con `table does not exist`, como estaba previsto.
- Verificacion posterior al SQL outbox:
  - `public.convex_mirror_events` existe y tenia `0` eventos pendientes al
    cierre.
  - `information_schema.triggers` reporto `132` filas para
    `convex_mirror_outbox`; esto corresponde a triggers por evento
    `INSERT/UPDATE/DELETE` en las tablas existentes.
  - `/api/migration/convex-sync?limit=50` en production respondio `ok=true`,
    `fetched=0`, `processed=0`, `failed=0`; ya no reporta
    `queueInstalled=false`.
  - `convex-health`, `convex-full-sync` y `convex-compare` criticos siguieron
    en verde: `health ok=true`, `full-sync ok=true failed=0 updated=0`,
    `compare ok=true issueCount=0`.
  - Busqueda local confirmo que ni el token temporal de Vercel ni la password
    de Supabase quedaron escritos en archivos del repo.

Fecha de investigacion: 2026-05-31  
Repo: `C:\Users\adven\OneDrive\Documentos\dev-projects\laralis`  
Produccion indicada por usuario: https://laralis.vercel.app/  
App operativa en este repo: `apps/dental`

## Estado y reglas de seguridad

Esta investigacion no implementa migracion. No se borro Supabase, no se cambio ningun flujo real y no se hizo commit.

Antes de escribir este documento se reviso `git status`. El worktree ya tenia cambios locales no atribuibles a esta investigacion:

- `apps/dental/app/api/whatsapp/webhook/route.ts`
- `apps/dental/lib/whatsapp/providers/base.ts`
- `apps/dental/lib/whatsapp/providers/dialog360.ts`
- `apps/dental/lib/whatsapp/providers/twilio.ts`
- `apps/dental/lib/whatsapp/service.ts`
- `apps/dental/lib/whatsapp/types.ts`
- `apps/dental/tests/qa/notification-provider-contracts.test.ts`

Esos cambios no se revirtieron ni se modificaron.

Actualizacion de Fase 0, 2026-05-31: se agrego un auditor read-only en `apps/dental/scripts/migration/supabase-readonly-audit.mjs` y se ejecuto contra QA y produccion. La auditoria no hace inserts, updates, deletes, ejecucion SQL/RPC ni exporta usuarios Auth; solo usa conteos `HEAD`, extremos de timestamps y metadatos agregados de Storage.

Resultados de produccion auditados:

- Supabase ref: `julrghzzqdgdwqaongct`.
- Tablas leibles: 56/56.
- Filas contadas en tablas de app: 2,277.
- Storage `clinic-snapshots`: 183 archivos, 6.2 MB.
- Evidencia local ignorada por git: `tmp/convex-migration-audit/supabase-readonly-audit-20260531T050848Z.json`.

Decision sobre suscripcion Supabase: no se cancela esta noche. Aunque el corte tecnico a Convex se haga esta noche, Supabase debe quedar activo como respaldo minimo 7-14 dias con produccion estable, y solo despues se debe bajar/cancelar cuando una auditoria confirme cero dependencias runtime, Auth/Storage resueltos y export/snapshot recuperable.

## Actualizacion operativa de la noche

Trabajo ejecutado el 2026-05-31:

- Se agrego `apps/dental/scripts/migration/supabase-readonly-audit.mjs`.
- Se agrego `apps/dental/scripts/migration/supabase-full-export.mjs`.
- Se agrego `apps/dental/scripts/migration/prepare-convex-import.mjs`.
- Se agrego `apps/dental/scripts/migration/verify-convex-import.mjs`.
- Se instalo `convex@1.39.1` en `apps/dental`.
- Se inicializo Convex para `apps/dental` y se creo/conecto el proyecto cloud dev `ismael-lsg/laralis`.
- Deployment Convex dev usado: `quaint-blackbird-737`.
- `.env.local` de `apps/dental` recibio `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` y `NEXT_PUBLIC_CONVEX_SITE_URL`; el archivo esta ignorado por git.
- Se agregaron funciones Convex en `apps/dental/convex/migration.ts` para conteos/listados por tabla, clinic y workspace.
- Se agregaron funciones Convex en `apps/dental/convex/authBridge.ts` para preparar credenciales de password en Convex, protegidas por `CONVEX_AUTH_BRIDGE_SECRET`.
- Se agrego cliente server-side en `apps/dental/lib/convex/server.ts`.
- Se agrego selector `DATA_BACKEND` en `apps/dental/lib/data-backend.ts`.
- Se agrego health-check interno protegido en `apps/dental/app/api/migration/convex-health/route.ts`.
- Se conecto el primer endpoint real, `GET /api/patients`, a Convex detras de feature flag:
  - default: Supabase.
  - `DATA_BACKEND_PATIENTS=dual_read`: responde Supabase y compara conteo con Convex en logs.
  - `DATA_BACKEND_PATIENTS=convex`: responde desde Convex.
- Se agrego puente de Auth apagado por defecto:
  - `apps/dental/app/api/auth/convex-bridge/route.ts`.
  - `apps/dental/app/api/auth/convex-login/route.ts`.
  - `apps/dental/app/api/auth/convex-logout/route.ts`.
  - `apps/dental/lib/auth/convex-session.ts`.
  - `apps/dental/lib/auth/password-bridge.ts`.
  - `apps/dental/hooks/use-auth.ts` llama al puente solo si `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1`.
- Se conecto `middleware.ts` a una cookie de sesion Convex firmada cuando `AUTH_BACKEND=convex` o `AUTH_BACKEND=dual`.
- Se conecto `resolveClinicContext` a Convex cuando no hay usuario Supabase y existe sesion Convex valida.
- Se conecto `forbiddenIfMissingPermission` a Convex cuando `AUTH_BACKEND=convex`, con fallback en `dual` si falla Supabase.

Actualizacion posterior de la misma noche:

- Se hizo un nuevo export read-only de produccion despues de los primeros trabajos:
  - Ruta: `tmp/supabase-production-export/supabase-export-20260531T084814Z/manifest.json`.
  - Tablas exportadas desde Supabase REST: 44/56.
  - Filas exportadas: 2,302.
  - Auth users exportados: 3.
  - Storage `clinic-snapshots`: 183 archivos, 6.2 MB.
- Se preparo el import Convex con tablas vacias incluidas:
  - Ruta: `tmp/supabase-production-export/supabase-export-20260531T084814Z/convex-import/manifest.json`.
  - Tablas preparadas: 45 incluyendo `supabase_auth_users`.
  - Filas preparadas: 2,305.
- Se sincronizo Convex dev con `--replace` desde ese manifest y se verifico:
  - Sync audit: `tmp/convex-migration-audit/convex-import-sync-20260531T084934Z.json`.
  - Verify audit: `tmp/convex-migration-audit/convex-import-verify-20260531T085409Z.json`.
  - Resultado: 45 tablas, 2,305 filas, OK.
- Se importo Supabase Storage `clinic-snapshots` a Convex Storage dev y se verifico:
  - Import audit: `tmp/convex-migration-audit/convex-storage-import-20260531T085418Z.json`.
  - Verify audit: `tmp/convex-migration-audit/convex-storage-verify-20260531T085545Z.json`.
  - Resultado: 183 archivos, 6,474,485 bytes, OK.
- Se separo lectura y escritura en `apps/dental/lib/data-backend.ts`:
  - `DATA_READ_BACKEND` / `DATA_READ_BACKEND_<DOMINIO>` decide si una ruta lee Supabase o Convex.
  - `DATA_WRITE_MODE` / `DATA_WRITE_MODE_<DOMINIO>` decide `supabase`, `dual` o `convex`.
  - Importante: `DATA_BACKEND_<DOMINIO>=convex` ya no debe implicar escritura solo Convex; por defecto queda escritura dual, salvo `DATA_WRITE_MODE=convex`.
- Se agrego un espejo generico Supabase -> Convex por outbox:
  - SQL preparado, no ejecutado automaticamente: `supabase/migrations/82_convex_mirror_outbox.sql`.
  - Endpoint protegido: `apps/dental/app/api/migration/convex-sync/route.ts`.
  - El SQL crea `public.convex_mirror_events`, funciones de instalacion/desinstalacion de triggers y una funcion trigger que captura insert/update/delete.
  - Por seguridad, los triggers no se instalan solos. Para activar captura hay que ejecutar explicitamente `select public.install_convex_mirror_triggers();`.
  - El endpoint no procesa nada salvo que `CONVEX_MIRROR_SYNC_ENABLED=1` y la request lleve `CRON_SECRET`.
  - `apps/dental/vercel.json` agenda `/api/migration/convex-sync` cada 2 minutos, pero queda inerte mientras el flag anterior no este activo.
  - Rollback del espejo: `select public.uninstall_convex_mirror_triggers();` y/o apagar `CONVEX_MIRROR_SYNC_ENABLED`.
- Se preparo espejo runtime de Storage para snapshots:
  - `apps/dental/lib/snapshots/storage.ts` sigue escribiendo y leyendo Supabase Storage como ruta primaria.
  - Si `DATA_WRITE_MODE_STORAGE=dual` o `DATA_WRITE_MODE=dual`, cada upload/delete de snapshot y manifest intenta duplicarse en Convex Storage.
  - Por defecto, si Convex Storage falla, no rompe el flujo del usuario; solo registra error. Para hacer obligatorio el espejo, usar `CONVEX_STORAGE_MIRROR_STRICT=1`.
  - Funciones Convex agregadas: `generateStorageUploadUrl`, `recordStorageObject`, `deleteStorageObject`.
- Se agregaron scripts para sincronizar/verificar Convex desde export preparado:
  - `apps/dental/scripts/migration/sync-prepared-convex-import.mjs`.
  - `apps/dental/scripts/migration/import-convex-storage.mjs`.
  - `apps/dental/scripts/migration/verify-convex-storage.mjs`.

Estado exacto frente al objetivo nuevo del usuario:

- Supabase produccion no fue borrado, cancelado ni modificado por estos comandos.
- Convex dev ya tiene una copia verificada de las tablas/Storage exportables por API.
- La base para comparar frontend leyendo Supabase vs Convex ya existe en dominios core.
- La base para mantener escrituras futuras sincronizadas ya existe como outbox, pero todavia no esta activada en Supabase produccion.
- La base para duplicar nuevos snapshots a Convex Storage ya existe, pero queda detras de flags de escritura.
- Falta probar el outbox primero en stage/preview antes de instalar triggers en produccion.

Preview desplegado para prueba segura:

- URL: `https://laralis-monorepo-preview-77l1mpbza-avanxia-labs.vercel.app`.
- Deploy ID: `dpl_6ZnmikHwbQeUA6v7BycLrKhpky7N`.
- Produccion `https://laralis.vercel.app/` no fue desplegada ni promovida.
- Variables agregadas solo a Preview de la rama `fix/dashboard-patients-seen-vs-new`:
  - `DATA_WRITE_MODE=dual`.
  - `DATA_WRITE_MODE_STORAGE=dual`.
  - `CONVEX_MIRROR_SYNC_ENABLED=0`.
  - `DATA_READ_BACKEND=supabase`.
- Verificacion del endpoint de sync en preview:
  - `/api/migration/convex-sync?dryRun=1` autenticado respondio `ok: true`, `disabled: true`.
- Verificacion de health en preview:
  - `/api/migration/convex-health` responde correctamente, pero marca mismatch porque Preview esta leyendo Supabase stage/QA y Convex dev contiene el snapshot de produccion.
  - Ejemplo: Preview Supabase `patients=169`; Convex dev `patients=246`.
  - Esto es esperado y confirma que no conviene comparar frontend stage contra Convex con datos de produccion. Para una prueba limpia se necesita o importar stage a Convex dev, o correr la comparacion contra produccion sin escribir.

Dependencias runtime que siguen impidiendo cancelar Supabase:

- El repo aun tiene muchas llamadas runtime a Supabase (`createClient`, `supabaseAdmin`, `.from`, `.storage`, `auth`), alrededor de 1,900 ocurrencias en `apps/dental/app/api`, `apps/dental/lib` y `middleware.ts`.
- Hay 121 handlers de escritura `POST/PUT/PATCH/DELETE` en `apps/dental/app/api`. Los dominios core ya tienen adapters parciales/directos; los demas quedan cubiertos por el outbox solo despues de instalar triggers.
- Auth sigue dependiendo de `supabase.auth.getUser()`, `signOut`, `signInWithOtp`, `auth.admin.getUserById`, `auth.admin.listUsers` y `auth.admin.deleteUser`.
- RPC sigue en uso para permisos, discovery de snapshots, booking availability y recurring expenses.
- Storage runtime sigue leyendo Supabase Storage; el espejo a Convex Storage es de escritura, no de lectura final.

Secuencia segura para activar el espejo sin cancelar Supabase:

1. Desplegar preview con estas variables: `CONVEX_MIRROR_SYNC_ENABLED=1`, `DATA_WRITE_MODE=dual`, `DATA_READ_BACKEND=supabase`, `DATA_WRITE_MODE_STORAGE=dual`.
2. Aplicar `supabase/migrations/82_convex_mirror_outbox.sql` primero en stage/QA.
3. Ejecutar `select public.install_convex_mirror_triggers();` en stage/QA.
4. Hacer una escritura pequena en stage/QA y verificar que aparece en `public.convex_mirror_events`.
5. Ejecutar `/api/migration/convex-sync?dryRun=1`, luego sin `dryRun`, y comparar conteos con `/api/migration/convex-health`.
6. Solo despues repetir la instalacion de outbox/triggers en produccion.
7. Mantener Supabase como fuente de verdad y rollback por flags: apagar `CONVEX_MIRROR_SYNC_ENABLED`, `DATA_WRITE_MODE=supabase`, `DATA_READ_BACKEND=supabase`, y si hace falta `select public.uninstall_convex_mirror_triggers();`.

Backup completo local de produccion:

- Ruta: `tmp/supabase-production-export/supabase-export-20260531T052238Z/manifest.json`.
- Tablas exportadas desde Supabase REST: 44/56.
- Filas exportadas: 2,285.
- Auth users exportados: 3.
- Storage `clinic-snapshots` exportado: 183 archivos, 6.2 MB.
- Tablas reportadas como ausentes por PostgREST durante export: `chat_sessions`, `chat_messages`, `ai_feedback`, `public_bookings`, `public_booking_services`, `booking_blocked_slots`, `quotes`, `quote_items`, `notification_retry_queue`, `whatsapp_notifications`, `whatsapp_templates`, `action_logs`.
- Nota: esas tablas aparecian en el inventario local/migraciones, pero produccion las reporto ausentes por la API de datos durante el export. Antes de corte final hay que verificar esquema con `pg_dump` o SQL directo desde Supabase Studio.

Import Convex dev:

- Se preparo un import Convex-safe en `tmp/supabase-production-export/supabase-export-20260531T052238Z/convex-import/manifest.json`.
- Convex rechazo el JSON crudo de `ai_chat_messages` por llaves no ASCII como `Campaña`.
- `prepare-convex-import.mjs` codifico 118 llaves incompatibles en `ai_chat_messages`.
- Se importaron 34 tablas con datos a Convex dev, incluyendo `supabase_auth_users`.
- Verificacion: los conteos en Convex coinciden con el manifest preparado para 34 tablas.
- Verificador reproducible: `node apps/dental/scripts/migration/verify-convex-import.mjs --manifest tmp/supabase-production-export/supabase-export-20260531T052238Z/convex-import/manifest.json`.
- Ultima verificacion registrada: 34 tablas, 2,288 filas en Convex dev, OK.

Bloqueador critico para cancelar/apagar Supabase esta noche:

- Laralis sigue usando Supabase Auth en middleware, login, registro, reset password, sesiones, perfil, MFA, permisos y muchas rutas API.
- La API admin de Supabase permite listar usuarios, pero no entrega hashes de contrasena reutilizables.
- Por lo tanto, apagar/eliminar el proyecto Supabase haria que login, refresh de sesion y `auth.getUser()` fallen.
- Se probo `exec_sql` en produccion solo con `select count(*) from auth.users`; la funcion no existe (`PGRST202`), asi que no hay via RPC para extraer hashes de Auth.
- `npx supabase projects list` no encontro proyecto linkeado. Para dump directo de `auth.users.encrypted_password` se necesita link/credencial de Postgres/Supabase Dashboard.
- Camino sin credencial DB: activar `NEXT_PUBLIC_CONVEX_AUTH_BRIDGE=1` y `CONVEX_AUTH_BRIDGE_SECRET` mientras Supabase Auth sigue activo. En cada login exitoso con Supabase, Laralis puede hashear el password en el servidor y guardar una credencial nueva en Convex. Asi el usuario no hace un reset ni ve un cambio.
- Limitacion del puente: solo migra credenciales de usuarios que vuelvan a iniciar sesion mientras el puente este activo. Usuarios que no vuelvan a loguearse antes de apagar Supabase requeriran magic link/reset o un dump directo de `auth.users`.
- Camino implementado para login post-puente:
  - `NEXT_PUBLIC_AUTH_BACKEND=supabase`: comportamiento actual.
  - `NEXT_PUBLIC_AUTH_BACKEND=dual`: intenta Supabase y, si falla, intenta Convex.
  - `NEXT_PUBLIC_AUTH_BACKEND=convex`: usa `/api/auth/convex-login`.
  - `AUTH_BACKEND=convex|dual`: middleware/API aceptan la cookie `laralis_convex_session`.
- Se configuraron secretos de desarrollo en `apps/dental/.env.local` y en Convex dev `quaint-blackbird-737`; no estan en git ni en produccion.
- Verificacion de Auth Convex dev: `authBridge.contextForUser` encontro 3 usuarios importados; 2 tienen clinicas por defecto y `authBridge.userHasPermission(..., "patients.view")` regreso `true`.
- Si "cancelar Supabase" significa bajar/cancelar el plan pagado pero mantener el proyecto Supabase activo en Free, eso puede ser viable por tamano actual: DB menor a 500 MB y Storage menor a 1 GB segun auditoria. Pero no es lo mismo que eliminar/apagar Supabase.
- Fuentes oficiales de billing consultadas: Supabase Free incluye 500 MB DB, 1 GB file storage, 50k MAUs y pausa por 1 semana de inactividad; Supabase factura por organizacion, no por proyecto, y planes distintos requieren organizaciones separadas.

## Resumen ejecutivo

Laralis no usa Supabase como una simple base de datos CRUD. Supabase hoy cubre:

- Auth y sesiones para login, registro, reset de password, email verification, OTP y metadatos de usuario.
- PostgreSQL con RLS, funciones SQL/RPC, triggers, indices y relaciones.
- Service role en una gran parte de las rutas API para saltar RLS despues de validaciones propias.
- Storage para snapshots comprimidos de clinicas.
- Realtime para el inbox.
- Datos criticos de una usuaria real: workspaces, clinicas, pacientes, tratamientos, precios, insumos, gastos, marketing, inbox/WhatsApp, configuraciones, snapshots, tokens de Google Calendar y notificaciones.

La migracion segura no debe empezar por reemplazar Auth. La recomendacion tecnica es:

1. Mantener Supabase como fuente de verdad.
2. Levantar Convex en paralelo solo en preview/staging.
3. Crear una capa de datos/adapters detras de las rutas API existentes.
4. Replicar/importar datos a Convex con IDs legacy preservados.
5. Validar lecturas, conteos y flujos antes de activar cualquier escritura real.
6. Hacer el corte con feature flag server-side y rollback instantaneo a Supabase.

No conviene migrar todo de una vez. El primer corte deberia limitarse a dominios core de lectura/escritura controlada, no Auth, no snapshots/storage, no webhooks de WhatsApp/SMS/email, no Google Calendar tokens.

## Fuentes externas revisadas

Documentacion oficial revisada el 2026-05-31:

- Convex Next.js App Router: https://docs.convex.dev/client/nextjs/app-router/
- Convex Next.js server rendering: https://docs.convex.dev/client/nextjs/app-router/server-rendering
- Convex Auth: https://docs.convex.dev/auth/convex-auth
- Convex Authentication general: https://docs.convex.dev/auth
- Convex Database: https://docs.convex.dev/database
- Convex Indexes: https://docs.convex.dev/database/reading-data/indexes/
- Convex Import/Export: https://docs.convex.dev/database/import-export/
- Convex Data Import: https://docs.convex.dev/database/import-export/import
- Convex File Storage: https://docs.convex.dev/file-storage
- Convex HTTP Actions: https://docs.convex.dev/functions/http-actions
- Convex limits/pricing details: https://docs.convex.dev/production/state/limits
- Convex pricing page: https://www.convex.dev/pricing
- Supabase pricing page: https://supabase.com/pricing

Puntos relevantes de esas fuentes:

- Convex + Next App Router funciona bien para Client Components con `convex/react`; para Server Components, Server Actions y Route Handlers hay SDKs especificos y consideraciones de auth.
- Convex Auth esta en beta. Su soporte de Next.js SSR/API routes/middleware esta marcado como en desarrollo o experimental en docs. Para Laralis esto lo vuelve riesgoso como primera fase.
- Convex no usa RLS declarativo tipo Postgres; la autorizacion se implementa en codigo al inicio de queries/mutations/actions.
- Convex Storage existe y sirve archivos mediante storage IDs, pero el modelo actual de Laralis usa rutas por `clinicId/snapshots/...` y manifests en Supabase Storage; se puede migrar, pero no como primer corte.
- Convex Import/Export esta en beta y soporta JSON/JSONL/CSV por tabla; para esta app conviene exportar desde Supabase a JSONL por tabla y preservar IDs legacy.
- Convex Free/Starter comparte limites S16. En docs actuales se listan, entre otros: 0.5 GB de database storage en Free, 1 GB/mes de database I/O Free, 1M function calls/mes Free, 1 GB storage de archivos Free, documento max 1 MiB, 32 indices por tabla y 16 campos por indice. Hay que medir Laralis antes de asumir ahorro.
- Supabase Free oficial incluye 500 MB DB, 50k MAUs, 5 GB egress, 1 GB file storage y pausa por inactividad; Pro empieza en USD 25/mes con 8 GB disk, 100 GB file storage, backups, etc.

## 1. Arquitectura actual

### Framework principal

- Monorepo npm workspaces (`package.json` raiz).
- App principal: `apps/dental`.
- Framework: Next.js 14.2 App Router, React 18, TypeScript, Tailwind, next-intl, shadcn/Radix, SWR.
- Backend principal: Next Route Handlers en `apps/dental/app/api/**`.
- Base actual: Supabase JS v2, `@supabase/ssr`, `@supabase/auth-helpers-nextjs`.
- Tests: Vitest + Cypress.

### Apps importantes

- `apps/dental` es la app real. La memoria local del proyecto tambien indicaba que Podent/Laralis opera aqui.
- No se detecto otra app activa equivalente para produccion dentro de `apps/*`.

### Rutas web criticas

Rutas de usuario autenticado:

- `/`: dashboard principal con metricas, reportes, ROI, marketing, equilibrio y graficas.
- `/patients`, `/patients/[id]`: pacientes e historial.
- `/treatments`, `/treatments/calendar`: tratamientos/citas/pagos/reembolsos.
- `/services`, `/supplies`, `/assets`, `/fixed-costs`, `/time`, `/tariffs`: costeo, precios e insumos.
- `/expenses`, `/marketing`, `/reports`, `/equilibrium`: finanzas/reportes.
- `/inbox`: inbox/realtime/WhatsApp/leads.
- `/prescriptions`: recetas/PDF.
- `/settings/*`: cuenta, equipo, permisos, booking, notificaciones, calendario, snapshots, export/import, seguridad.
- `/onboarding`, `/setup`, `/setup/resume`, `/setup/cancel`: creacion y recuperacion de workspace/clinica.

Rutas publicas:

- `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback`, `/auth/logout`, `/auth/verify-email`.
- `/book/[slug]`, `/book/[slug]/confirmation`: booking publico.
- `/invite/[token]`: invitaciones.
- `/terms`, `/privacy`.

APIs criticas:

- `/api/onboarding`, `/api/workspaces/**`, `/api/clinics/**`
- `/api/patients/**`, `/api/treatments/**`, `/api/services/**`, `/api/supplies/**`
- `/api/expenses/**`, `/api/assets/**`, `/api/fixed-costs/**`, `/api/tariffs/**`
- `/api/dashboard/**`, `/api/analytics/**`, `/api/reports/**`
- `/api/public/**`, `/api/bookings/**`
- `/api/inbox/**`, `/api/whatsapp/webhook`, `/api/webhooks/twilio/sms-status`, `/api/webhooks/resend`
- `/api/cron/**`
- `/api/export/**`, `/api/snapshots/**`, `/api/reset/**`

### Despliegue en Vercel

Configuracion local:

- `apps/dental/vercel.json`
  - `framework`: `nextjs`
  - `buildCommand`: `npm run build`
  - `installCommand`: `npm install`
  - `outputDirectory`: `.next`
  - region: `sfo1`
  - crons:
    - `/api/cron/complete-appointments` diario 00:01
    - `/api/cron/recurring-expenses` diario 00:05
    - `/api/cron/send-reminders` cada 15 min
    - `/api/cron/retry-notifications` cada 10 min
    - `/api/cron/snapshots` diario 03:00
    - `/api/cron/cleanup-draft-workspaces` diario 03:30

El proyecto Vercel vinculado localmente en `.vercel/project.json` es:

- `projectName`: `laralis-monorepo-preview`
- `projectId`: presente localmente, no repetir en tickets publicos si no hace falta.

`vercel env ls` confirmo variables cifradas para el proyecto `avanxia-labs/laralis-monorepo-preview`. Esto no confirma por si solo que `https://laralis.vercel.app/` apunte a ese mismo proyecto; hay que verificar domain mapping antes de un corte.

### Variables de entorno usadas en produccion

Confirmadas en Vercel como `Production`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOTP_ENCRYPTION_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `KIMI_API_KEY`
- `DEEPGRAM_API_KEY`
- `AI_TTS_PROVIDER`
- `AI_LLM_PROVIDER`
- `AI_STT_PROVIDER`

Variables mencionadas en `.env.example` o codigo pero no vistas en Vercel actual:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_VERSION`
- `AI_LLM_MODEL`
- `AI_DEFAULT_LANGUAGE`
- `AI_LLM_TEMPERATURE`
- `AI_RATE_LIMITING_ENABLED`
- `AI_RATE_LIMIT_PER_HOUR`
- `OPENAI_API_KEY` opcional
- `AI_TTS_VOICE`
- `VAPID_SUBJECT`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_WEBHOOK_SECRET`

Riesgo: si se activa Convex en preview/prod, se tendrian que agregar por lo menos `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT` y cualquier token server-side necesario para migracion. No agregarlos a produccion hasta que el selector de backend mantenga default `supabase`.

## 2. Mapa Supabase actual

### Clientes Supabase centrales

| Archivo | Que hace | Riesgo | Equivalente Convex probable |
|---|---|---:|---|
| `apps/dental/lib/supabase.ts` | Cliente browser legacy con `createClient`, storageKey `laralis-auth` | Alto | Reemplazar por Convex React client solo cuando el frontend use Convex directo |
| `apps/dental/lib/supabase-browser.ts` | Cliente browser SSR helper | Alto | `ConvexReactClient` y provider |
| `apps/dental/lib/supabase/client.ts` | Browser client con env vars publicas | Alto | Convex client provider |
| `apps/dental/lib/supabase/server.ts` | Server client con cookies de Next | Critico | `fetchQuery/fetchMutation` o servidor Next verificando Supabase Auth y llamando Convex |
| `apps/dental/lib/supabaseAdmin.ts` | Service role server-side, salta RLS | Critico | Convex internal/public functions con checks de autorizacion en codigo |
| `apps/dental/lib/supabase/clean-cookies.ts` | Limpia cookies Supabase malformadas | Medio | Eliminar solo despues de retirar Supabase Auth |
| `apps/dental/middleware.ts` | Rate limit opcional + refresca Supabase session + protege rutas + resuelve workspace | Critico | Mantener en Supabase inicialmente; luego middleware con proveedor auth nuevo y/o backend selector |

### Auth y sesion

| Archivo | Uso Supabase | Tablas/Auth | Riesgo | Equivalente Convex probable |
|---|---|---|---:|---|
| `apps/dental/hooks/use-auth.ts` | Login, registro, logout, reset password, user metadata | Supabase Auth | Critico | Fase posterior: Convex Auth/Clerk/Auth0/WorkOS; no fase 1 |
| `apps/dental/app/auth/callback/route.ts` | Exchange code for session y redireccion post signup | Auth, `workspaces` | Critico | Mantener hasta migrar auth |
| `apps/dental/app/auth/logout/route.ts` | `signOut` server | Auth | Alto | Mantener |
| `apps/dental/app/auth/reset-password/page.tsx` | `setSession`, `updateUser`, redirige por workspaces | Auth, `workspaces` | Alto | Mantener |
| `apps/dental/app/auth/verify-email/page.tsx` | `getUser`, resend email | Auth | Alto | Mantener |
| `apps/dental/app/auth/debug/page.tsx` | Debug de session/user | Auth | Bajo | Remover o reimplementar dev-only |
| `apps/dental/app/profile/ProfileClient.tsx` | Actualiza user metadata | Auth | Medio | User profile mutation en Convex si auth migra |
| `apps/dental/app/settings/security/SecuritySettingsClient.tsx` | Reauth, update password, logout | Auth | Alto | Auth provider nuevo |
| `apps/dental/app/api/auth/delete-account/route.ts` | Borra cuenta/datos con admin y OTP | Auth admin, memberships, workspaces | Critico | Convex mutation transaccional + proveedor auth |
| `apps/dental/app/api/auth/delete-account/send-code/route.ts` | Envia OTP y guarda `verification_codes` | Auth, `verification_codes` | Alto | Convex mutation/action o proveedor auth |
| `apps/dental/app/api/auth/force-logout/route.ts` | Cierra sesion desde HTML emergencia | Browser Auth | Alto | Rehacer solo cuando auth cambie |

Conclusion auth: Laralis usa Supabase Auth de forma profunda. La sesion se conserva por cookies SSR de Supabase, local/session storage y cookies propias `workspaceId`/`clinicId`. Los roles no son roles de Supabase: viven en tablas `workspace_users`, `workspace_members`, `clinic_users`, `custom_role_templates`, `role_permissions` y RPCs de permisos.

### RLS, service role y autorizacion

Patron dominante:

- Muchas rutas API usan `supabaseAdmin` para leer/escribir con service-role.
- La autorizacion real se hace en codigo: user actual via Supabase Auth, workspace/clinic membership, permisos, cookies `clinicId` y validaciones Zod.
- Algunas lecturas de browser todavia usan anon client y dependen de RLS, especialmente `WorkspaceContext.refreshClinics`.
- RLS sigue siendo parte del modelo de seguridad de Supabase y aparece en `FULL-SCHEMA-v56.sql` y migraciones 39, 46, 50, 52, 61, 62, 65, 66, 69, 70, 72, 73, 74, 80.

En Convex no hay RLS SQL. Cada query/mutation/action debera empezar con checks equivalentes:

1. Usuario autenticado.
2. Workspace visible/activo.
3. Clinic accesible.
4. Permiso granular `resource.action`.
5. Reglas especiales de owner/admin/service.

Esto debe codificarse como helpers compartidos, no duplicarse en cada funcion.

### Storage

Uso real detectado:

- `apps/dental/lib/snapshots/storage.ts`
- `apps/dental/lib/snapshots/exporter.ts`
- `apps/dental/lib/snapshots/importer.ts`
- `apps/dental/app/api/snapshots/**`
- `supabase/migrations/69_create_snapshot_system.sql`

Bucket esperado:

- `clinic-snapshots`
- No publico
- Limite sugerido en SQL: 100 MB
- Rutas: `{clinic_id}/snapshots/{snapshot_id}.json.gz` y `{clinic_id}/manifest.json`

Convex Storage puede guardar blobs y devolver storage IDs, pero no conserva naturalmente la misma semantica de bucket/ruta. Recomendacion: no migrar storage en la primera fase. Mantener snapshots en Supabase Storage o exportarlos a un sistema externo neutral durante el corte. Si despues se migra a Convex Storage, guardar `storageId`, checksum, bytes, contentType y legacy path en `clinic_snapshots`.

### Realtime

Uso real detectado:

- `apps/dental/app/inbox/InboxClient.tsx`
  - canal `inbox_conversations:{clinicId}`
  - canal `inbox_messages:{conversationId}`
  - `postgres_changes`

No se detecto uso amplio de Supabase Realtime fuera del inbox. Convex es fuerte en reactividad, pero migrar este flujo implica reescribir queries del inbox y su autorizacion. No debe ser fase 1 si WhatsApp/inbox esta activo.

### Edge functions

No existe carpeta `supabase/functions`. No se detectaron Supabase Edge Functions. `supabase/03-invitation-functions.sql` contiene funciones SQL, no edge functions.

### RPC SQL usados desde codigo

| RPC | Archivos | Riesgo | Convex equivalente |
|---|---|---:|---|
| `user_has_clinic_access` | `lib/clinic.ts`, `lib/auth/verify-clinic-access.ts`, `app/api/clinics/route.ts` | Alto | Helper `requireClinicAccess` |
| `check_user_permission` | `lib/permissions/check.ts`, `lib/middleware/with-permission.ts`, `app/api/permissions/check/route.ts` | Alto | Helper `requirePermission` |
| `get_user_permissions` | `app/api/permissions/my/route.ts` | Alto | Query `permissions:listForUserClinic` |
| `discover_clinic_tables` | `lib/snapshots/discovery.ts` | Medio/Alto | Metadata Convex propia, no information_schema |
| `get_table_columns` | `lib/snapshots/discovery.ts` | Medio | Schema manifest Convex |
| `get_table_foreign_keys` | `lib/snapshots/discovery.ts` | Medio | Orden hardcodeado/manifest |
| `process_recurring_expenses` | `app/api/cron/recurring-expenses/route.ts` | Alto | Convex scheduled/internal mutation |
| `check_booking_slot_availability` | `app/api/public/book/route.ts` | Alto | Query/mutation de disponibilidad con indices |
| `exec_sql` | `scripts/run-migration.js` | Bajo para runtime, alto si se usa mal | No migrar; usar migraciones Convex/schema |

### SQL migrations

Hay muchas migraciones duplicadas/historicas. Fuentes mas relevantes:

- `supabase/FULL-SCHEMA-v56.sql`: snapshot grande del esquema hasta v56.
- `supabase/migrations/58_recurring_expenses.sql` a `81_grant_ai_chat_tables.sql`: agregan piezas importantes posteriores.
- `supabase/migrations/69_create_snapshot_system.sql`: snapshots + storage.
- `supabase/migrations/70_granular_permissions_system.sql` y `76_custom_roles_support.sql`: permisos.
- `supabase/migrations/74_inbox_conversations.sql` y `77_lead_attribution_and_treatment_link.sql`: inbox/leads/atribucion.
- `supabase/migrations/80_notification_retry_queue.sql` y `81_grant_ai_chat_tables.sql`: notificaciones/chat.

Riesgo: la carpeta SQL local no garantiza el estado exacto de produccion. Fase 0 debe incluir introspeccion viva (`pg_dump --schema-only` o SQL de `information_schema`) y conteos por tabla.

## 3. Inventario por archivo

Resumen automatico:

- 225 archivos contienen referencias a Supabase, env vars Supabase o helpers relacionados.
- 160 archivos usan `supabaseAdmin` o service-role de forma directa/indirecta.
- 69 archivos tocan Auth.
- 12 archivos llaman RPC.
- 3 archivos usan Storage.

La tabla siguiente prioriza archivos con acoplamiento directo a Supabase. Archivos de UI que solo hacen `fetch('/api/...')` heredan el riesgo de la API correspondiente.

### API routes

| Archivo | Supabase actual | Riesgo | Convex probable |
|---|---|---:|---|
| `app/api/actions/adjust-service-margin/route.ts` | Auth + admin action helper | Medio | Action/mutation interna |
| `app/api/actions/analyze-patient-retention/route.ts` | Auth + admin action helper | Medio | Query/action analytics |
| `app/api/actions/bulk-update-prices/route.ts` | Auth + admin action helper | Alto | Mutation transaccional |
| `app/api/actions/compare-periods/route.ts` | Auth + admin action helper | Medio | Query analytics |
| `app/api/actions/create-expense/route.ts` | Auth + admin action helper | Alto | Mutation expense |
| `app/api/actions/forecast-revenue/route.ts` | Auth + admin action helper | Medio | Query/action analytics |
| `app/api/actions/history/route.ts` | Auth | Medio | Query action logs |
| `app/api/actions/identify-underperforming-services/route.ts` | Auth + admin action helper | Medio | Query/action analytics |
| `app/api/actions/optimize-inventory/route.ts` | Auth + admin action helper | Medio | Query/action inventory |
| `app/api/actions/simulate-price-change/route.ts` | Auth + admin action helper | Medio | Query/action pricing |
| `app/api/actions/update-service-price/route.ts` | Auth + admin action helper | Alto | Mutation service pricing |
| `app/api/actions/update-time-settings/route.ts` | Auth + admin action helper | Alto | Mutation settings |
| `app/api/ai/chat/history/route.ts` | `ai_chat_sessions`, `ai_chat_messages`, Auth | Medio | Queries chat history |
| `app/api/ai/chat/route.ts` | Supabase env stage checks | Bajo | Keep route, backend selector |
| `app/api/ai/feedback/route.ts` | `ai_feedback`, `chat_messages`, Auth | Medio | Mutation feedback |
| `app/api/ai/query/route.ts` | `marketing_campaigns`, admin, stage guard | Medio | Action/query assistant |
| `app/api/ai/sessions/route.ts` | `chat_sessions`, Auth | Medio | Query/mutation chat sessions |
| `app/api/ai/sessions/[id]/route.ts` | `chat_sessions`, `chat_messages`, Auth | Medio | Query/mutation chat session |
| `app/api/ai/sessions/[id]/messages/route.ts` | `chat_sessions`, `chat_messages`, Auth | Medio | Query/mutation messages |
| `app/api/ai/synthesize/route.ts` | Supabase env stage checks | Bajo | No DB dependency |
| `app/api/ai/transcribe/route.ts` | Supabase env stage checks | Bajo | No DB dependency |
| `app/api/analytics/break-even/route.ts` | `fixed_costs`, `treatments` | Medio | Indexed analytics query |
| `app/api/analytics/cac-trend/route.ts` | `categories`, `expenses` | Medio | Indexed analytics query |
| `app/api/analytics/channel-roi/route.ts` | `categories`, `expenses`, `marketing_campaigns`, `patients`, `treatments` | Medio/Alto | Aggregation query/action |
| `app/api/analytics/compare/route.ts` | `expenses`, `treatments`, Auth | Medio | Query with access helper |
| `app/api/analytics/expenses/route.ts` | `expenses` | Medio | Query expenses |
| `app/api/analytics/inventory/alerts/route.ts` | `supplies`, `service_supplies`, Auth | Medio | Query inventory |
| `app/api/analytics/marketing-metrics/route.ts` | `expenses`, `leads`, `patients`, `treatments` | Medio/Alto | Aggregation query |
| `app/api/analytics/patients/stats/route.ts` | `patients`, `treatments`, Auth | Medio | Query patients stats |
| `app/api/analytics/planned-vs-actual/route.ts` | `expenses`, `fixed_costs` | Medio | Query finance |
| `app/api/analytics/predictions/route.ts` | `treatments` | Medio | Query/action prediction |
| `app/api/analytics/profit-analysis/route.ts` | `assets`, `expenses`, `fixed_costs`, `treatments` | Medio/Alto | Aggregation query |
| `app/api/analytics/refunds/route.ts` | `treatments` | Medio | Query treatments |
| `app/api/analytics/revenue/route.ts` | `treatments` | Medio | Query treatments |
| `app/api/analytics/service-roi/route.ts` | `treatments` | Medio | Query treatments |
| `app/api/analytics/services/top/route.ts` | `treatments`, Auth | Medio | Query services |
| `app/api/analytics/treatments/frequency/route.ts` | `treatments`, Auth | Medio | Query treatments |
| `app/api/assets/route.ts` | `assets` | Alto | CRUD mutations |
| `app/api/assets/[id]/route.ts` | `assets` | Alto | CRUD mutations |
| `app/api/assets/summary/route.ts` | `assets` | Medio | Query assets |
| `app/api/auth/delete-account/route.ts` | Auth admin + memberships/workspaces | Critico | Later auth-provider + Convex mutation |
| `app/api/auth/delete-account/send-code/route.ts` | Auth OTP + `verification_codes` | Alto | Later auth-provider |
| `app/api/auth/force-logout/route.ts` | Browser Auth | Alto | Later auth-provider |
| `app/api/bookings/route.ts` | `public_bookings` | Alto | Booking mutations |
| `app/api/bookings/[id]/route.ts` | `patients`, `public_bookings`, `services` | Alto | Booking admin mutations |
| `app/api/categories/route.ts` | `categories`, `category_types` | Alto | CRUD categories |
| `app/api/categories/[id]/route.ts` | `categories`, `category_types`, Auth | Alto | CRUD categories |
| `app/api/clinic/[clinicId]/export/route.ts` | Many clinic tables | Critico | Export adapter; do not migrate first |
| `app/api/clinics/route.ts` | `clinics`, RPC `user_has_clinic_access`, Auth | Critico | Clinic query/mutation + access helper |
| `app/api/clinics/[id]/route.ts` | `clinics`, `workspaces`, Auth | Critico | Clinic mutation |
| `app/api/clinics/discount/route.ts` | `clinics` | Alto | Mutation clinic settings |
| `app/api/cron/cleanup-draft-workspaces/route.ts` | `workspaces` | Alto | Convex scheduled function |
| `app/api/cron/complete-appointments/route.ts` | `clinics`, `treatments` | Alto | Scheduled mutation |
| `app/api/cron/recurring-expenses/route.ts` | RPC `process_recurring_expenses` | Alto | Scheduled mutation |
| `app/api/cron/retry-notifications/route.ts` | `email_notifications`, `sms_notifications` | Alto | Scheduled retry action |
| `app/api/cron/send-reminders/route.ts` | `email_notifications`, `scheduled_reminders` | Alto | Scheduled action |
| `app/api/cron/snapshots/route.ts` | `clinics`, `workspaces`, Auth admin | Alto | Keep Supabase Storage initially |
| `app/api/dashboard/*` | `expenses`, `patients`, `services`, `supplies`, `treatments`, `public_bookings` | Medio | Read queries with indices |
| `app/api/equilibrium/*` | `assets`, `fixed_costs`, `settings_time`, `treatments` | Medio | Finance queries |
| `app/api/expenses/route.ts` | `assets`, `categories`, `expenses`, `supplies` | Alto | CRUD expenses |
| `app/api/expenses/[id]/route.ts` | `categories`, `expenses`, `supplies` | Alto | CRUD expenses |
| `app/api/expenses/alerts/route.ts` | `expenses`, `fixed_costs`, `supplies` | Medio | Query alerts |
| `app/api/expenses/stats/route.ts` | `expenses`, `fixed_costs` | Medio | Query stats |
| `app/api/export/generate/route.ts` | Auth + `workspace_activity` | Critico | Export adapter; preserve Supabase until validated |
| `app/api/export/import/route.ts` | Auth + `workspace_activity` | Critico | Import adapter; phase late |
| `app/api/export/validate/route.ts` | Auth | Medio | Validation only |
| `app/api/fixed-costs/route.ts` | `fixed_costs` | Alto | CRUD fixed costs |
| `app/api/fixed-costs/[id]/route.ts` | `fixed_costs` | Alto | CRUD fixed costs |
| `app/api/inbox/*` | `inbox_conversations`, `inbox_messages`, `leads`, `patients` | Critico | Later Convex realtime/inbox |
| `app/api/invitations/route.ts` | `clinics`, `invitations`, `workspace_users` | Alto | Invitation workflow |
| `app/api/invitations/[id]/resend/route.ts` | `clinics`, `invitations`, `workspace_users` | Alto | Invitation workflow |
| `app/api/invitations/accept/[token]/route.ts` | memberships, roles, Auth | Alto | Invitation mutation |
| `app/api/invitations/reject/[token]/route.ts` | `invitations` | Medio | Invitation mutation |
| `app/api/marketing/campaigns/route.ts` | `categories`, `marketing_campaigns`, `patients` | Alto | CRUD marketing |
| `app/api/marketing/campaigns/[id]/route.ts` | `marketing_campaigns`, `patients` | Alto | CRUD marketing |
| `app/api/marketing/campaigns/roi/route.ts` | `expenses`, `marketing_campaigns`, `patients`, `treatments` | Medio/Alto | Aggregation query |
| `app/api/marketing/platforms/route.ts` | `categories` | Medio | Categories query/mutation |
| `app/api/marketing/platforms/[id]/route.ts` | `categories` | Medio | Categories mutation |
| `app/api/marketing/roi/route.ts` | `expenses`, `patients`, `treatments` | Medio | Query |
| `app/api/medications/route.ts` | `medications` | Medio | CRUD medications |
| `app/api/notifications/push/*` | `push_subscriptions`, `push_notifications` | Alto | Notification tables/actions |
| `app/api/notifications/send-confirmation/route.ts` | `clinics`, `email_notifications`, `treatments` | Alto | Action + mutation |
| `app/api/onboarding/route.ts` | Auth + `workspaces`, `clinics`, memberships | Critico | Do not migrate until auth/data adapters stable |
| `app/api/patient-sources/route.ts` | `patient_sources` | Medio | CRUD sources |
| `app/api/patients/route.ts` | `patients` | Critico | CRUD patients |
| `app/api/patients/[id]/route.ts` | `patients`, `services`, `treatments` | Critico | CRUD/history patients |
| `app/api/permissions/check/route.ts` | RPC `check_user_permission` | Alto | Authorization helper |
| `app/api/permissions/my/route.ts` | memberships + RPC `get_user_permissions` | Alto | Permission query |
| `app/api/prescriptions/route.ts` | `patients`, `prescriptions`, `prescription_items` | Alto | CRUD prescriptions |
| `app/api/prescriptions/[id]/route.ts` | `prescriptions`, `prescription_items` | Alto | CRUD prescriptions |
| `app/api/prescriptions/[id]/pdf/route.ts` | `clinics`, `prescriptions` | Medio | PDF stays in Next route |
| `app/api/public/availability/route.ts` | booking tables, `services`, `treatments` | Alto | Public availability query |
| `app/api/public/book/route.ts` | booking + patients + notifications + RPC availability | Critico | Public booking action |
| `app/api/public/clinic/[slug]/route.ts` | `clinics`, `public_booking_services` | Alto | Public clinic query |
| `app/api/reports/*` | `patients`, `treatments` | Medio | Read queries |
| `app/api/reset/route.ts` | Many core tables + Auth | Critico | Dangerous; keep Supabase until late |
| `app/api/reset/status/route.ts` | setup tables + Auth | Alto | Setup status query |
| `app/api/services/route.ts` | `assets`, `fixed_costs`, `service_supplies`, `services`, `settings_time` | Critico | Service pricing CRUD |
| `app/api/services/[id]/route.ts` | `patients`, `service_supplies`, `services`, `treatments` | Critico | Service CRUD |
| `app/api/services/[id]/cost/route.ts` | pricing tables | Alto | Pricing query |
| `app/api/services/[id]/supplies/*` | `service_supplies`, `services` | Alto | Service recipe mutations |
| `app/api/settings/booking/route.ts` | `clinics`, `public_booking_services`, `services` | Alto | Booking settings |
| `app/api/settings/notifications/route.ts` | `clinics` | Medio | Clinic notification settings |
| `app/api/settings/notifications/test*.ts` | `clinics`, `whatsapp_notifications`, Auth | Medio/Alto | Provider test actions |
| `app/api/settings/preferences/route.ts` | Auth + `user_settings` | Alto if auth migrates | User settings mutation |
| `app/api/settings/security/mfa/*` | Auth + TOTP/user settings | Alto | Auth-provider/MFA phase |
| `app/api/settings/time/route.ts` | `settings_time` | Alto | Settings mutation |
| `app/api/settings/user/route.ts` | Auth + `user_settings` | Alto | User profile/settings |
| `app/api/setup/status/route.ts` | setup/pricing tables | Alto | Setup query |
| `app/api/snapshots/**` | `clinic_snapshots`, Storage, Auth | Critico | Keep Supabase Storage initially |
| `app/api/supplies/route.ts` | `supplies` | Alto | CRUD supplies |
| `app/api/supplies/[id]/route.ts` | `service_supplies`, `supplies` | Alto | CRUD supplies |
| `app/api/tariffs/route.ts` | pricing/tariff tables | Alto | Tariff query/mutation |
| `app/api/team/*` | memberships, roles, RPC `is_clinic_member` | Critico | Permission/membership mutations |
| `app/api/treatments/route.ts` | `treatments`, patients, services, costs, notifications | Critico | Treatment mutation/action |
| `app/api/treatments/[id]/**` | `treatments`, `patients`, reminders | Critico | Treatment mutations |
| `app/api/webhooks/resend/route.ts` | Supabase env stage check, email webhook | Alto | Keep Next route; write via adapter |
| `app/api/webhooks/twilio/sms-status/route.ts` | Supabase env stage check | Alto | Keep Next route; write via adapter |
| `app/api/whatsapp/webhook/route.ts` | `clinics`, `inbox_*`, `leads`, `marketing_campaign*` | Critico | Keep Supabase first; later Convex inbox |
| `app/api/workspaces/route.ts` | `workspaces`, `clinics`, memberships, Auth | Critico | Workspace queries/mutations |
| `app/api/workspaces/[id]/**` | `workspaces`, `clinics`, memberships, Auth | Critico | Workspace lifecycle mutations |

### Non-API direct Supabase usage

| Archivo | Supabase actual | Riesgo | Convex probable |
|---|---|---:|---|
| `app/inbox/InboxClient.tsx` | Realtime + `inbox_conversations`, `inbox_messages` | Critico | Convex live queries later |
| `contexts/workspace-context.tsx` | Auth state, `clinics`, cookies/localStorage | Critico | Provider + workspace query; keep until auth plan |
| `app/invite/[token]/InvitePageClient.tsx` | Auth user lookup | Alto | Later auth provider |
| `app/setup/cancel/page.tsx` | Auth + `workspaces` cleanup/signout | Alto | Later setup adapter |
| `components/LanguageSwitcher.tsx` | Auth metadata update | Medio | User settings mutation |
| `lib/ai/actions/*.ts` | Domain reads/writes via injected Supabase client | Alto | Convex internal helpers/actions |
| `lib/ai/ClinicSnapshotService.ts` | Snapshot of many tables | Medio/Alto | Convex query bundle after schema |
| `lib/ai/service.ts` | `action_logs`, `custom_categories`, `services` | Medio | Action log/service helpers |
| `lib/auth-user-profiles.ts` | Auth admin | Alto | Auth-provider phase |
| `lib/auth/verify-clinic-access.ts` | RPC access check | Alto | Shared access helper |
| `lib/calc/patient-acquisition.ts` | `treatments` | Medio | Query helper |
| `lib/calendar/server-conflicts.ts` | `public_bookings`, `treatments` | Alto | Availability query |
| `lib/clinic.ts` | `clinics`, `workspaces`, RPC access, Auth | Critico | Access/workspace helpers |
| `lib/clinic-tables.ts` | marketing campaign tables | Medio | Table registry |
| `lib/email/webhooks.ts` | `email_notifications` | Alto | Webhook mutation |
| `lib/export/exporter.ts` | Full export table list | Critico | Export adapter; late phase |
| `lib/export/importer.ts` | Full import table list | Critico | Import adapter; late phase |
| `lib/google-calendar.ts` | `clinic_google_calendar`, external OAuth | Critico | Keep in Supabase initially; sensitive tokens |
| `lib/middleware/with-permission.ts` | RPC permission check | Alto | Shared permission helper |
| `lib/notifications/retry-queue.ts` | `notification_retry_queue` | Alto | Scheduled retry table |
| `lib/permissions/check.ts` | RPC permission check | Alto | Shared permission helper |
| `lib/push/service.ts` | `push_notifications`, `push_subscriptions` | Alto | Push action + tables |
| `lib/security/mfa-preferences.ts` | `user_settings` | Alto if auth migrates | User settings/MFA phase |
| `lib/sms/service.ts` | `clinics`, `sms_notifications` | Alto | SMS action + tables |
| `lib/snapshots/discovery.ts` | `information_schema`, RPC discovery | Alto | Convex schema manifest |
| `lib/snapshots/exporter.ts` | `clinic_snapshots`, Storage | Critico | Keep Supabase Storage initially |
| `lib/snapshots/importer.ts` | Storage restore | Critico | Keep Supabase Storage initially |
| `lib/snapshots/storage.ts` | Supabase Storage bucket | Critico | Convex Storage later |
| `lib/whatsapp/service.ts` | `clinics`, `inbox_messages`, `whatsapp_notifications`, `whatsapp_templates` | Critico | Keep current until inbox stable |
| `lib/workspace-access.ts` | `clinics`, `workspaces` | Critico | Access helper |
| `lib/workspace-lifecycle.ts` | `clinics`, `patients`, `treatments` | Critico | Lifecycle helper |
| `cypress.config.ts` | Stage cleanup/seed with service role | Medio | QA seeding via Convex dev/preview |
| `scripts/qa-stage-seed.mjs` | Stage writes with service-role guard | Medio | Convex seed script |
| `scripts/qa-stage-assert.mjs` | Stage read assertions | Medio | Convex assert script |
| `scripts/run-migration.js` | RPC `exec_sql` | Bajo runtime/alto danger | Retire for Convex |
| `tests/setup.ts`, `tests/api/*.test.ts`, `tests/qa/*.test.ts` | Supabase mocks/env | Bajo/Medio | Update test harness |

## 4. Modelo de datos reconstruido

### Tablas core y criticidad

| Dominio | Tablas | Criticidad | Nota de migracion |
|---|---|---:|---|
| Identidad organizacional | `workspaces`, `clinics`, `workspace_users`, `workspace_members`, `clinic_users`, `invitations`, `user_settings`, `verification_codes` | Critico | Preservar owner, memberships, roles, clinic/workspace selected |
| Costeo y operaciones | `settings_time`, `fixed_costs`, `assets`, `supplies`, `services`, `service_supplies`, `tariffs`, `categories`, `category_types`, `custom_categories` | Critico | Mantener centavos enteros y snapshots de precio/costo |
| Pacientes y tratamientos | `patients`, `treatments` | Critico | No perder historial clinico, pagos, reembolsos, fechas |
| Finanzas y marketing | `expenses`, `patient_sources`, `marketing_campaigns`, `marketing_campaign_status_history`, `leads`, `marketing_campaign_channels` | Critico | Afecta atribucion y reportes de rentabilidad |
| Inbox/WhatsApp | `inbox_conversations`, `inbox_messages`, `whatsapp_notifications`, `whatsapp_templates` | Critico si esta activo | Realtime/webhooks; no migrar primero |
| Booking publico | `public_bookings`, `public_booking_services`, `booking_blocked_slots` | Alto | Public routes deben seguir operando |
| Notificaciones | `email_notifications`, `scheduled_reminders`, `sms_notifications`, `push_subscriptions`, `push_notifications`, `notification_retry_queue` | Alto | Hay crons y webhooks externos |
| Documentos clinicos | `medications`, `prescriptions`, `prescription_items`, `quotes`, `quote_items` | Alto si se usan | PDFs pueden regenerarse, data no |
| Google Calendar | `clinic_google_calendar` | Critico/Sensible | Contiene access/refresh tokens |
| Backups/snapshots | `clinic_snapshots` + Storage `clinic-snapshots` | Critico | Es rollback funcional; no tocar en primera fase |
| AI/Lara | `chat_sessions`, `chat_messages`, `ai_chat_sessions`, `ai_chat_messages`, `ai_feedback`, `action_logs`, `workspace_activity` | Medio/Alto | Historial puede ser valioso; action logs utiles para auditoria |

### Relaciones principales

- `workspaces.owner_id -> auth.users.id`
- `clinics.workspace_id -> workspaces.id`
- `workspace_users.workspace_id -> workspaces.id`, `workspace_users.user_id -> auth.users.id`
- `workspace_members.workspace_id -> workspaces.id`, `workspace_members.user_id -> auth.users.id`
- `clinic_users.clinic_id -> clinics.id`, `clinic_users.user_id -> auth.users.id`
- Casi todas las tablas operativas tienen `clinic_id -> clinics.id`
- `patients.source_id -> patient_sources.id`
- `patients.campaign_id -> marketing_campaigns.id`
- `patients.referred_by_patient_id -> patients.id`
- `treatments.patient_id -> patients.id`
- `treatments.service_id -> services.id`
- `expenses.category_id -> categories.id`
- `expenses.related_asset_id -> assets.id`
- `expenses.related_supply_id -> supplies.id`
- `service_supplies.service_id -> services.id`
- `service_supplies.supply_id -> supplies.id`
- `tariffs.service_id -> services.id`
- `public_bookings.patient_id -> patients.id`
- `public_bookings.service_id -> services.id`
- `inbox_messages.conversation_id -> inbox_conversations.id`
- `leads.converted_patient_id -> patients.id`
- `prescription_items.prescription_id -> prescriptions.id`
- `quote_items.quote_id -> quotes.id`

### Campos importantes a preservar

- Todos los UUID legacy (`id`, foreign keys). En Convex deben guardarse como `legacyId` y `legacy*Id` aunque luego se creen `_id` nativos.
- Todos los montos en centavos: `amount_cents`, `price_cents`, `purchase_price_cents`, `fixed_cost_per_minute_cents`, `variable_cost_cents`, `total_cents`, etc.
- Fechas/horas: `treatment_date`, `treatment_time`, `expense_date`, `created_at`, `updated_at`, `payment_date`, `scheduled_for`, `next_retry_at`.
- Estados: workspace lifecycle, booking status, treatment payment/refund, notification status, inbox status, lead status.
- JSON: `settings`, `permissions`, `custom_permissions`, `allowed_clinics`, `working_days_config`, notification configs, metadata.
- Tokens y secretos en DB: `clinic_google_calendar.access_token`, `refresh_token`, TOTP/user security settings. Estos requieren trato especial y quizas re-encriptado.

### Indices importantes

Localmente hay muchos indices. Los que Convex necesita como minimo:

- Por tenant: `by_workspace`, `by_clinic`, `by_clinic_active`.
- Por listas cronologicas: `by_clinic_createdAt`, `by_clinic_updatedAt`, `by_clinic_treatmentDate`, `by_clinic_expenseDate`.
- Por FK: patient, service, supply, campaign, category, conversation, quote/prescription.
- Por flujos publicos: `clinics.by_slug`, `public_bookings.by_clinic_date_time`, `booking_blocked_slots.by_clinic_date`.
- Por inbox: `inbox_conversations.by_clinic_status`, `by_clinic_contact`, `by_lastMessageAt`, `inbox_messages.by_conversation_createdAt`.
- Por notificaciones: `scheduled_reminders.by_due_status`, `notification_retry_queue.by_status_nextRetry`, `push_subscriptions.by_user_active`.

Convex limita indices por tabla y campos por indice; hay que disenar indices desde los queries reales, no copiar todos los indices Postgres.

### Datos que no se pueden perder

- Pacientes, tratamientos, pagos, reembolsos, notas clinicas.
- Servicios, tarifas, insumos, recetas de servicios, activos, costos fijos y configuracion de tiempo.
- Gastos, campanas, leads, atribucion, inbox y conversaciones si se usan para negocio.
- Workspaces, clinicas, membresias, permisos y roles.
- Tokens de Google Calendar y configuraciones de notificaciones.
- Snapshots/backups existentes.

### Datos que podrian regenerarse

- Categorias de sistema y `role_permissions` default, si hay seed idempotente y se validan custom overrides.
- PDFs de recetas/cotizaciones si los datos fuente estan completos.
- Reportes/graficas/agregados calculados.
- Algunos logs de notificacion/action logs antiguos, si se decide conservar solo desde cierta fecha. Recomendacion: exportarlos igual, aunque se resten prioridad.

## 5. Auth

Laralis usa Supabase Auth de forma real:

- Login por email/password: `supabase.auth.signInWithPassword`.
- Registro: `supabase.auth.signUp` con metadata `first_name`, `last_name`, `full_name`, `preferred_language` y redirect a `/auth/callback`.
- Email verification: `auth/verify-email` y callback.
- Reset password: `resetPasswordForEmail`, `setSession`, `updateUser`.
- Logout: `signOut`.
- Delete account usa OTP/admin flows.
- Middleware refresca sesion y protege rutas.
- `WorkspaceProvider` escucha `onAuthStateChange`.

Sesion:

- Cookies Supabase SSR manejadas por `@supabase/ssr`.
- Browser client mantiene sesion.
- App guarda seleccion de workspace/clinic en localStorage y cookies propias.

Roles/permisos:

- No dependen solo de Supabase Auth.
- Tablas: `workspace_users`, `workspace_members`, `clinic_users`, `custom_role_templates`, `role_permissions`.
- RPCs: `check_user_permission`, `get_user_permissions`, `user_has_clinic_access`, `is_clinic_member`.

Recomendacion:

- No migrar Auth en la primera fase.
- Fase inicial: mantener Supabase Auth como identidad y mover datos detras de Next API routes con server-side adapter. Como la app ya usa muchas API routes, esto evita exponer Convex client auth desde el navegador al principio.
- Fase posterior: evaluar si conviene Convex Auth, Clerk, Auth0 o WorkOS. Convex Auth esta en beta y su soporte Next SSR/API/middleware aun no es la opcion menos riesgosa para esta app.

## 6. Storage / archivos

Storage detectado:

- Snapshots gzip/json de clinicas en Supabase Storage.
- `clinic_snapshots` guarda metadata, checksum, tamanos y manifest.
- Bucket esperado: `clinic-snapshots`, privado, 100 MB por archivo en SQL.

No se detecto Supabase Storage para imagenes de perfil, PDFs, audios o backups aparte del sistema de snapshots. PDFs de recetas/cotizaciones parecen generarse en route handlers y campos como `pdf_url` existen, pero no se vio upload Supabase para ellos.

Convex Storage sirve para guardar archivos, pero:

- Convex usa storage IDs, no bucket/path semantico.
- Hay que migrar manifests y checksums.
- File storage cuenta contra limites propios.

Recomendacion:

- Mantener Supabase Storage inicialmente.
- Antes de migrarlo medir:
  - cantidad de snapshots
  - bytes por clinica
  - total bucket
  - archivos huerfanos
  - snapshots que realmente se usan para rollback
- Si se migra despues, hacer un job de copia: Supabase Storage -> Convex Storage, guardar `convexStorageId`, `legacyStoragePath`, checksum y bytes; validar descarga/restauracion.

## 7. Plan de migracion seguro

### Fase 0: backups y snapshot de produccion

Objetivo: poder volver atras aunque todo falle.

Tareas:

- Confirmar que `https://laralis.vercel.app/` corresponde al proyecto Vercel que se va a tocar.
- Congelar alcance: no cambiar produccion, no tocar Supabase prod.
- Exportar schema vivo de Supabase produccion.
- Exportar datos por tabla a JSONL/CSV con conteos y checksums.
- Exportar Auth users/metadata de forma autorizada.
- Exportar Storage `clinic-snapshots`.
- Descargar/registrar Vercel env var names por environment, sin valores en docs.
- Tomar snapshot funcional desde la propia app si el modulo snapshots esta sano.
- Guardar reporte local con:
  - counts por tabla
  - min/max `created_at`
  - checksums por tabla
  - total Storage bytes
  - lista de tablas vacias/no usadas

No avanzar sin snapshot verificado.

### Fase 1: Convex paralelo sin afectar produccion

Objetivo: Convex existe, pero produccion sigue leyendo/escribiendo Supabase.

Tareas:

- Crear proyecto Convex dev/staging.
- Agregar Convex solo a preview, no a production.
- Definir schema inicial en Convex con `legacyId` string y foreign keys legacy string para reducir riesgo de mapeo.
- Crear helpers de autorizacion equivalentes a membership/permission, pero inicialmente solo usados en preview.
- Crear scripts de import dry-run desde export Supabase a Convex staging.
- No conectar UI de produccion.

### Fase 2: adapters/capa de datos

Objetivo: evitar reemplazar 225 archivos a mano.

Tareas:

- Crear interfaz interna por dominio: patients, treatments, services, finance, workspace, permissions.
- Mantener rutas API existentes como contrato publico de la app.
- Implementar `DATA_BACKEND=supabase|convex|dual_read|dual_write` server-side.
- Default absoluto: `supabase`.
- En `dual_read`, responder con Supabase pero comparar Convex en logs/metricas.
- En `dual_write`, escribir Supabase primero, luego Convex, con cola de reconciliacion si falla Convex.

### Fase 3: migrar datos

Objetivo: cargar Convex con datos completos y comparables.

Estrategia:

- Exportar cada tabla a JSONL.
- Guardar UUID original como `legacyId`.
- Guardar FKs originales como `legacyClinicId`, `legacyPatientId`, etc.
- Evitar convertir todo a `Id<"table">` hasta que conteos y queries validen.
- Preservar timestamps como ISO strings o numbers consistentes.
- Preservar dinero como enteros. Si se usa `v.int64`, convertir con cuidado a BigInt; si se usa number, validar rango seguro.
- Importar en orden de dependencias:
  1. workspaces, clinics
  2. memberships/permisos
  3. categorias/settings/core cost tables
  4. patients
  5. services/supplies/service_supplies/tariffs
  6. treatments/expenses/marketing/leads
  7. booking/inbox/notifications
  8. snapshots metadata
  9. logs/chat/exportables
- Comparar counts y checksums logicos por tabla.

### Fase 4: preview/staging con Convex

Objetivo: probar app real sin tocar produccion.

Tareas:

- Deploy Vercel preview con `DATA_BACKEND=convex` o `dual_read`.
- Usar datos copiados anonimizados o snapshot autorizado.
- Ejecutar smoke manual y Cypress stage.
- Validar que no llama Supabase para dominios migrados excepto Auth.
- Mantener Supabase Auth si fase de auth no esta incluida.

### Fase 5: pruebas de regresion

Objetivo: probar flujos de la usuaria real antes del corte.

Minimo:

- Login/logout/reset.
- Onboarding/setup/resume si aplica.
- Seleccion workspace/clinica.
- Crear/editar/borrar paciente.
- Crear/editar tratamiento, pago, reembolso.
- Servicios, insumos, recetas de servicio, tarifas.
- Gastos, costos fijos, activos, configuracion de tiempo.
- Dashboard, reportes, ROI, marketing.
- Booking publico.
- Inbox/WhatsApp si se incluye.
- Recetas/PDF.
- Export/import/snapshots si se incluye.
- Permisos por rol.
- Crons.
- Webhooks Resend/Twilio/WhatsApp en staging.
- Comparacion Supabase vs Convex por tabla y endpoint.

### Fase 6: corte controlado

Objetivo: cambiar produccion con ventana corta y rollback listo.

Condiciones previas:

- Supabase sigue intacto.
- Convex staging iguala counts/checksums.
- Preview validado.
- Feature flag probado.
- Ultimo backup tomado.

Corte:

1. Anunciar ventana corta.
2. Opcional: pausar escritura no esencial.
3. Export incremental desde ultimo snapshot.
4. Import incremental a Convex.
5. Activar `DATA_BACKEND=convex` solo para dominios migrados.
6. Monitorear logs, errores, counts y reportes clave.
7. Mantener dual-write o Supabase intacto hasta tener confianza.

### Fase 7: rollback plan

Rollback inmediato:

- Cambiar `DATA_BACKEND=supabase` en Vercel.
- Redeploy/restart si hace falta.
- No borrar Convex ni Supabase.
- Si hubo dual-write, reconciliar diferencias despues.

Rollback de datos:

- Si Supabase fue la fuente primaria durante dual-write, no restaurar.
- Si se corto escritura a Convex, reimportar delta desde Convex a Supabase solo con script revisado, o restaurar Supabase snapshot si hubo corrupcion. No hacer esto manualmente en dashboard.

## 8. Estrategia anti-ruptura

- Supabase sigue siendo fuente de verdad hasta fase 6.
- No eliminar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ni `SUPABASE_SERVICE_ROLE_KEY`.
- No tocar Supabase Storage inicialmente.
- Auth queda en Supabase al principio.
- Feature flag server-side, no controlable por cliente.
- Rutas API conservan sus contratos JSON.
- `dual_read` compara sin afectar respuesta.
- `dual_write` escribe Supabase primero.
- Logs de comparacion sin datos sensibles.
- Vercel preview obligatorio antes de prod.
- Rollback es cambiar env var y redeploy, no revertir datos.

No migrar todavia si es riesgoso:

- Auth.
- Snapshots/Storage.
- Google Calendar tokens.
- WhatsApp/inbox/realtime.
- Webhooks de Twilio/Resend.
- Delete account/reset/import/export.
- Crons de notificaciones.

## 9. Tests necesarios

### Unit/API

- Helpers de autorizacion: owner/admin/member/viewer/custom role.
- Conversores Supabase row -> Convex doc.
- Dinero en centavos y BigInt/number.
- Fechas y zonas horarias.
- Reglas de pricing/tariffs.
- Booking availability.
- Permission matrix.

### E2E minimo antes de tocar produccion

- Login, logout, reset password.
- Crear/editar paciente.
- Crear/editar tratamiento.
- Pago, pendiente, reembolso.
- Servicio con insumos y precio.
- Gasto/costo fijo/activo.
- Dashboard y reportes con mismos numeros.
- Marketing/ROI.
- Booking publico.
- Team/permisos.
- Export/import/snapshots, si se incluyen.
- Inbox/WhatsApp, si se incluye.
- Vercel preview con Convex.
- Comparacion por endpoint: Supabase response vs Convex response normalizada.

### Data validation

- Conteos por tabla.
- Checksums por tabla y por clinica.
- Registros huerfanos.
- FKs faltantes.
- Pacientes/tratamientos/gastos del rango mas reciente.
- Totales financieros de dashboard antes/despues.
- Ultimo snapshot descargable/restaurable.

## 10. Archivos que habria que tocar en una migracion real

Primera ola segura:

- Nuevo `apps/dental/convex/*` o `apps/dental/convex/schema.ts` si Convex vive dentro de la app.
- Nuevos adapters en `apps/dental/lib/data/**`.
- Nuevos scripts `apps/dental/scripts/migration/**`.
- Rutas API de lectura/CRUD core detras del adapter:
  - patients
  - services
  - supplies
  - fixed-costs
  - assets
  - settings/time
  - treatments
  - expenses
  - dashboard/analytics seleccionados

No tocar en primera ola:

- `middleware.ts`
- `hooks/use-auth.ts`
- `contexts/workspace-context.tsx`, salvo para lecturas no-auth muy controladas
- `lib/snapshots/**`
- `lib/google-calendar.ts`
- `lib/whatsapp/**`
- `app/api/whatsapp/webhook/route.ts`
- `app/api/auth/**`
- `app/api/export/**`
- `app/api/reset/**`

## 11. Orden recomendado

1. Snapshot vivo de Supabase produccion y Storage.
2. Medicion de tamano/costos reales.
3. Schema Convex staging con IDs legacy.
4. Importador dry-run y reporte de comparacion.
5. Adapter de solo lectura para un dominio no destructivo, por ejemplo `dashboard` o `patients` read-only.
6. Preview con `dual_read`.
7. CRUD de un dominio pequeno, por ejemplo `fixed_costs` o `patient_sources`.
8. Dominio core `patients`.
9. Dominio core `services/supplies/tariffs`.
10. Dominio `treatments/expenses`.
11. Reportes y dashboards.
12. Booking/notificaciones/inbox.
13. Storage.
14. Auth, solo si el costo/beneficio lo justifica despues.

## 12. Estimacion de dificultad

Dificultad global: alta.

Razones:

- 225 archivos con acoplamiento a Supabase.
- 160 con admin/service-role.
- Auth, middleware y workspace lifecycle estan entrelazados.
- SQL usa RLS, RPCs, triggers y funciones que en Convex deben reescribirse en TypeScript.
- Hay datos criticos reales y al menos una usuaria en produccion.
- Webhooks, crons, notificaciones, Storage y realtime aumentan blast radius.

Estimacion por fases:

- Fase 0 auditoria/backups: 1-2 dias.
- Schema Convex + import dry-run core: 3-5 dias.
- Adapter core + dual_read: 3-7 dias.
- CRUD core y reportes: 1-2 semanas.
- Booking/notificaciones/inbox/storage/auth: 2-4 semanas adicionales si se decide migrar todo.

Para una reduccion de costo rapida, puede ser mas barato primero medir Supabase real y optimizar plan/uso que migrar toda la app.

## 13. Primera tarea concreta

Crear una tarea read-only de auditoria viva, sin cambiar produccion:

`apps/dental/scripts/migration/audit-supabase-production.mjs`

Debe:

- Usar `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` solo en entorno local seguro.
- Rechazar escritura.
- Imprimir y guardar localmente en carpeta ignorada por git:
  - lista de tablas reales
  - conteos
  - columnas
  - indices/policies/functions
  - storage bucket size
  - min/max `created_at`
  - conteos por clinic/workspace
- No imprimir secretos ni PII.

Despues de esa auditoria, decidir el primer dominio piloto para `dual_read`. Mi recomendacion: `fixed_costs` o `patient_sources`, no `patients` ni `treatments` como primer CRUD.

## 14. Estado ejecucion 2026-05-31 noche

Objetivo operativo de esta tanda: avanzar hacia corte a Convex sin tocar produccion.

Hecho:

- Export completo de Supabase produccion guardado localmente en `tmp/supabase-production-export/supabase-export-20260531T052238Z/`.
- Import preparado e importado a Convex dev, verificado con 34 tablas y 2,288 documentos.
- Convex functions desplegadas en dev con `npx convex dev --once --typecheck disable`.
- Capa de flags creada:
  - `DATA_BACKEND`
  - `DATA_BACKEND_PATIENTS`
  - `DATA_BACKEND_SUPPLIES`
  - `DATA_BACKEND_SERVICES`
  - `DATA_BACKEND_TREATMENTS`
  - `AUTH_BACKEND`
  - `NEXT_PUBLIC_AUTH_BACKEND`
- Preview de Vercel creado:
  - `https://laralis-monorepo-preview-biluw9vpw-avanxia-labs.vercel.app`
  - Variables Convex y flags agregadas solo a Preview para la rama `fix/dashboard-patients-seen-vs-new`.
  - Produccion `https://laralis.vercel.app/` no fue modificada.
- Rutas con soporte Convex por flag:
  - `GET/POST /api/patients`
  - `GET/PUT/DELETE /api/patients/[id]`
  - `GET/POST /api/supplies`
  - `GET/PUT/DELETE /api/supplies/[id]`
  - `GET/POST /api/services`
  - `GET/POST /api/treatments`
- Auth bridge creado para capturar credenciales en Convex despues de login Supabase, pero todavia no hay garantia de credenciales Convex para usuarios existentes si Supabase Auth se apaga antes de que inicien sesion con el bridge activo.

No hecho / bloqueantes para apagar Supabase:

- Produccion todavia depende de Supabase en muchas rutas: dashboard, analytics, expenses, fixed-costs, assets, settings, snapshots, inbox, whatsapp, bookings, crons, webhooks, export/import, MFA y account deletion.
- Storage sigue en Supabase. Laralis usa poco Storage, pero la organizacion Supabase completa reporta 6.369 GB de Storage en el ciclo actual.
- La suscripcion Supabase es por organizacion `Karasowl2`, no por proyecto. La misma suscripcion Pro incluye `Laralis` y `Whisperall`.
- La organizacion esta en Pro y usa 2 proyectos; bajar toda la organizacion a Free puede afectar tambien `Whisperall`.
- Supabase Free incluye cuotas menores que Pro. Segun dashboard Supabase el uso actual de la organizacion es 6.369 GB Storage, 1.387 GB egress y 2 MAU; Storage excede el limite Free actual de 1 GB por documentacion oficial.

Decision segura:

- No borrar el proyecto Supabase.
- No pausar Supabase.
- No bajar la organizacion `Karasowl2` de Pro a Free hasta separar/limpiar `Whisperall` o confirmar que la organizacion completa queda dentro de cuotas Free.
- Si el objetivo financiero es dejar de pagar Supabase por Laralis, la ruta segura es:
  1. Transferir Laralis a una organizacion separada Free, o
  2. Migrar tambien lo que consume Storage/compute en `Whisperall`, o
  3. Mantener Supabase Pro hasta que ambos proyectos puedan operar fuera de Supabase o dentro de Free.

Rollback:

- Produccion no fue cambiada, por lo que el rollback actual es no promover el preview.
- En Preview, retirar o cambiar a `supabase` los flags `DATA_BACKEND_*` revierte lecturas/escrituras core a Supabase.
