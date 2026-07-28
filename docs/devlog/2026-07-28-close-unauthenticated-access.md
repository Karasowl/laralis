# Cierre de accesos no autenticados (Convex, IA, booking, rate limiting)

**Fecha:** 2026-07-28
**Tipo:** Seguridad P0
**Versión:** 0.6.1 → 0.7.0
**TASK ids:** TASK-20260728-close-public-convex-queries, TASK-20260728-auth-ai-routes, TASK-20260728-booking-notification-deferral, TASK-20260728-firewall-rate-limits

---

## Contexto

Auditoría completa de la rama `fix/dashboard-patients-seen-vs-new` (commit `adf54e6`), la que sirve
producción. Se revisaron las 183 rutas de API, la capa de datos de Convex, el middleware y el pipeline,
y se ejecutaron typecheck, tests de cálculo, `npm audit` y los scripts de i18n.

Salieron 28 hallazgos. Este devlog cubre los cuatro P0 de seguridad. El resto está en el informe de
auditoría y en `tasks/backlog.md`.

## Problema

**1. La base de datos era pública.** `convex/migration.ts` exportaba nueve funciones como `query` de
Convex, sin secreto y sin `ctx.auth`. En Convex una `query` pública es invocable por cualquiera que
conozca la URL del deployment, y esa URL se llama `NEXT_PUBLIC_CONVEX_URL`, o sea que viaja en el bundle
del navegador. `listTable` además recibe el nombre de la tabla como argumento:

```
POST https://<deployment>.convex.cloud/api/query
{"path":"migration:listTable","args":{"table":"patients","limit":10000},"format":"json"}
```

Comprobado en vivo antes del fix: producción devolvía `{"patients": 251, "treatments": 442}` sin
credenciales. `getStorageObjectUrl` entregaba además URLs firmadas de descarga de cualquier blob.

**2. Los endpoints de IA no pedían nada.** `/api/ai/transcribe` y `/api/ai/synthesize` sin sesión, sin
clínica, sin permiso, y sin límite de tamaño en el audio. Convertían el despliegue en un servicio de voz
gratuito facturado al proyecto.

**3. El agendamiento público era un relé de mensajería.** `POST /api/public/book` tomaba `patient_email`
y `patient_phone` del cuerpo y despachaba email, SMS y WhatsApp a esos destinos con las cuentas de Resend
y Twilio de la clínica.

**4. El rate limiting nunca existió.** El código de `@upstash/ratelimit` en `middleware.ts` no protegía
nada: el `matcher` excluye `/api`, la rama de Convex no llamaba al limitador, y las variables de Upstash
no estaban configuradas en ningún entorno, así que `getRateLimiter()` devolvía `null` siempre.

## Causa raíz

La migración de Supabase a Convex movió la capa de datos pero no su modelo de seguridad. En Supabase
había dos capas: la autorización del código y RLS dentro de la base. Convex no tiene RLS, la seguridad se
escribe en cada función. Las funciones se escribieron como herramienta de migración, cuando eran de uso
interno, y al convertirse en la capa de datos de la aplicación nadie revisó que seguían siendo públicas.

Los otros tres son omisiones independientes, no consecuencia de la migración.

## Qué cambió

### Convex

Las nueve queries piden ahora el secreto compartido de servidor, el mismo patrón que ya usaban las diez
mutaciones del mismo archivo. `internalQuery` se descartó: la documentación de Convex confirma que las
funciones internal no son invocables desde ningún cliente, incluido el `ConvexHttpClient` que usa el
servidor de Next, así que convertirlas habría roto la aplicación entera.

El argumento `secret` se declara `v.optional` a propósito. Convex rechaza argumentos no declarados, así
que un argumento obligatorio habría devuelto error en todas las peticiones en vuelo del build anterior en
el instante del despliegue. La aplicación del secreto se controla con `CONVEX_QUERY_SECRET_ENFORCED`, lo
que permite desplegar Convex primero (abierto), luego Next (que ya manda el secreto), y cerrar al final
con una variable de entorno, sin downtime y con reversión instantánea.

`convex/testHelpers.ts` queda con doble guarda (`CONVEX_TEST_HELPERS_ENABLED`), porque fija el hash de
contraseña de cualquier email y el secreto solo era una guarda demasiado débil para algo tan alcanzable.

### Rutas de IA

Envueltas en `withAnyPermission(['lara.use_entry_mode', 'lara.use_query_mode'])`. Sus únicos consumidores
son `VoiceRecorder.tsx` y `AudioPlayer.tsx`, dentro del asistente Lara, que solo se monta en pantallas con
sesión. `transcribe` rechaza audio de más de 25MB con 413. `synthesize` pasa su `Cache-Control` de
`public` a `private`, porque ahora está detrás de sesión.

### Agendamiento público

El despacho al contacto de la petición queda desactivado por defecto
(`PUBLIC_BOOKING_DISPATCH_TO_REQUESTER`). Las filas de notificación se siguen escribiendo, marcadas
`deferred_until_confirmation`. El mensaje sale ahora desde `confirmBooking`, que es el primer punto donde
un humano ha validado la solicitud.

Eso cerró además un hueco previo: `POST /api/treatments` ya disparaba
`sendAllTreatmentCreatedNotifications` al crear una cita, pero confirmar una reserva pública creaba un
tratamiento en silencio.

### Rate limiting

Cuatro reglas en el Firewall de Vercel, declaradas en `scripts/firewall/rules.sh`. Corta en el edge, antes
de invocar una función, así que cubre `/api` sea cual sea el backend de auth, y Vercel no factura el
tráfico que limita. El código muerto de Upstash y sus dos dependencias se eliminan.

## Archivos tocados

- `convex/migration.ts`, `convex/testHelpers.ts`
- `lib/convex/server.ts` (`getConvexMutationSecret` renombrado a `getConvexBridgeSecret`)
- `scripts/migration/{verify-convex-import,verify-convex-storage,import-convex-storage}.mjs`
- `app/api/ai/{transcribe,synthesize}/route.ts`, `lib/ai/route-guards.ts` (nuevo)
- `app/api/ai/sessions/**` (consolidación de `laraPermissionForMode`)
- `app/api/public/book/route.ts`, `app/api/bookings/[id]/route.ts`
- `middleware.ts` (420 → 357 líneas), `scripts/firewall/rules.sh` (nuevo)
- `package.json`, `package-lock.json`, `VersionBadge.tsx`, `messages/version.{es,en}.json`

## Antes vs Después

| | Antes | Después |
|---|---|---|
| `listTable(patients)` sin credenciales | 251 filas | Unauthorized |
| `getStorageObjectUrl` sin credenciales | URL firmada | Unauthorized |
| `/api/ai/transcribe` sin sesión | 200 | 401 |
| Booking público → mensajería | Despacha al contacto recibido | Difiere a la confirmación |
| 14 POST a `/api/public/book` | 14 procesados | 10 procesados, 4 cortados con 403 |
| Confirmar una reserva | No notificaba | Notifica como cualquier cita |

## Cómo probar

```bash
# La fuga está cerrada
curl -s -X POST https://superb-grouse-940.convex.cloud/api/query \
  -H 'Content-Type: application/json' \
  -d '{"path":"migration:listTable","args":{"table":"patients","limit":1},"format":"json"}'
# -> Unauthorized Convex migration request

# La app sigue leyendo (404 = la consulta a Convex funcionó, el slug no existe)
curl -s -o /dev/null -w "%{http_code}\n" https://laralis.vercel.app/api/public/clinic/xxx

# El rate limit corta
for i in $(seq 1 14); do curl -s -o /dev/null -w "%{http_code} " \
  -X POST https://laralis.vercel.app/api/public/book -H 'Content-Type: application/json' -d '{}'; done
# -> 400 x10, luego 403
```

## Riesgos y rollback

- **Convex:** `npx convex env remove CONVEX_QUERY_SECRET_ENFORCED --prod` reabre las consultas al
  instante, sin redespliegue. Es el interruptor de emergencia si algún llamante quedó sin actualizar.
- **Booking:** `PUBLIC_BOOKING_DISPATCH_TO_REQUESTER=1` restaura el acuse inmediato al solicitante.
- **Firewall:** las reglas se desactivan desde el panel sin tocar código.
- **Rutas de IA:** revertir el commit. No hay interruptor, porque no debería haberlo.

## Incidente durante el trabajo

A mitad del despliegue se descubrió que el proyecto de Vercel llevaba 19 horas pausado y producción
devolvía 503. No lo causó este trabajo: el proyecto se pausó el 27 de julio a las 20:32 UTC, diecinueve
horas antes del primer push. La causa fue Spend Management, con `Pause Projects` activado, al superar el
tope de 20 USD de gasto bajo demanda. El consumo lo generó `whisperall-web` (39,22 USD de 40,33, todo en
horas de compilación); `laralis` había gastado 7 céntimos en todo el ciclo. Se subió el tope a 25 USD y se
reanudaron los 24 proyectos del equipo.

Queda pendiente y sin diagnosticar por qué `whisperall-web` consume 189 horas de CPU de build al mes.

## Siguientes pasos

- Validación de identidad dentro de Convex, para recuperar la segunda capa que daba RLS. Requiere terminar
  antes el cutover de auth (hoy producción sigue con login de Supabase, `AUTH_BACKEND=dual`).
- Las 92 lecturas con escaneo completo de tabla y techo de 10.000 filas, que truncan datos en silencio.
- Las 10 rutas que aún crean un cliente Supabase crudo y se romperán al apagar Supabase.
- Las 137 claves de i18n usadas y ausentes.
- El CVE crítico de `@auth/core` y los cuatro altos.
- Reactivar `typecheck` y `lint` en el build y en CI.
