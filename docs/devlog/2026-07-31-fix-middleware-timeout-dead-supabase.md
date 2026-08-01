# 504 MIDDLEWARE_INVOCATION_TIMEOUT: el middleware esperaba sin límite a un Supabase que ya no existe

**Fecha:** 2026-07-31
**Versión:** 0.7.1
**Tasks:** TASK-20260731-middleware-supabase-timeout
**Severidad:** P0, producción inaccesible para usuarios con sesión iniciada

## Contexto

La doctora reportó por WhatsApp a las 5:43 p.m. (23:43 UTC) que al abrir Laralis le
salía una pantalla de error de Vercel:

```
504: GATEWAY_TIMEOUT
Code: MIDDLEWARE_INVOCATION_TIMEOUT
ID: sfo1::wprwr-1785541381929-45b12cae2151
```

Desde fuera la aplicación se veía sana. Un `GET /` sin cookies respondía 307 hacia el
login en 250 ms, y `/auth/login` cargaba en 200. El fallo solo aparecía para quien ya
tenía sesión.

## Problema

Producción devolvía 504 en cada carga de página a los usuarios autenticados. Los logs
de runtime de Vercel mostraban, en el mismo request, decenas de fallos idénticos y
después el corte del runtime:

```
[TypeError: fetch failed] {
  [cause]: Error: getaddrinfo ENOTFOUND julrghzzqdgdwqaongct.supabase.co
}
...
[Error: Your function was stopped as it did not return an initial response within 25s]
```

En 7 días hubo exactamente 2 respuestas 504, ambas a las 23:43 y 23:44 UTC del
2026-07-31, que son los dos intentos de la doctora.

## Causa raíz

El proyecto de Supabase de producción dejó de existir en DNS. Verificado desde dos
resolvers independientes:

```
$ nslookup julrghzzqdgdwqaongct.supabase.co 8.8.8.8
** server can't find julrghzzqdgdwqaongct.supabase.co: NXDOMAIN
```

Producción corre con `AUTH_BACKEND=dual`, así que `middleware.ts` entraba siempre por
la rama `supabaseMiddleware` y llamaba a `supabase.auth.getUser()` en cada petición que
no fuera un asset. Con el host inalcanzable esa llamada no vuelve: en la
infraestructura de Vercel cada `getaddrinfo` fallido tarda segundos y supabase-js
reintenta los errores de red con backoff exponencial. Sumado supera los 25 segundos de
límite de invocación de middleware y Vercel devuelve el 504.

Detalle que explica por qué el fallo era selectivo: `getUser()` solo sale a la red
cuando hay una cookie de sesión de Supabase que parsear. Un visitante anónimo falla en
local, al instante, y por eso el login se veía perfecto mientras la aplicación estaba
inutilizable para la única persona que la usa a diario.

Lo importante es que la dependencia ya era innecesaria. Producción lleva unos 54 días
con `DATA_READ_BACKEND=convex`, `DATA_WRITE_MODE=convex` y
`DATA_WRITE_MODE_STORAGE=convex`. De Supabase solo quedaba la autenticación, y las
credenciales están espejadas en Convex: se verificó contra el deployment de producción
que `authBridge:credentialByEmail` devuelve credencial `scrypt:v1` para la cuenta de la
doctora. O sea, el 504 no lo causaba una funcionalidad que dependiera de Supabase, sino
una llamada de cortesía en el camino crítico de cada request.

## Qué cambió

`apps/dental/middleware.ts`, solo la rama supabase:

1. **La sesión de Convex se resuelve primero.** Es una verificación HMAC sobre una
   cookie, sin red. Si es válida, la petición ya está autenticada y no se crea siquiera
   el cliente de Supabase. Ambos backends usan el mismo UUID como identidad
   (`convexSession.sub` es el `supabaseUserId` espejado), así que adelantar esta
   comprobación no cambia quién es el usuario.
2. **Techo duro de 2.5 s en toda llamada a Supabase** mediante un helper `withTimeout`.
   Un timeout se trata como "sin usuario de Supabase", que es exactamente lo que vale
   una respuesta que no llega. Cubre `getUser()` y el bloque de recuperación
   `getSession()` / `setSession()`.
3. **Un fallo al resolver workspaces ya no expulsa a nadie.** `getAccessibleWorkspaces`
   devolvía `[]` tanto para "este usuario no tiene workspace" como para "no pude
   averiguarlo", y lo segundo habría mandado a `/onboarding` a un usuario válido en
   cuanto el backend fallara. Ahora existe `getAccessibleWorkspacesOrUnknown`, que
   devuelve `null` para el caso desconocido, y los tres puntos que lo consumen dejan al
   usuario donde está en lugar de redirigirlo.

## Archivos tocados

- `apps/dental/middleware.ts`
- `apps/dental/package.json` (0.7.0 a 0.7.1)
- `apps/dental/components/ui/VersionBadge.tsx`
- `apps/dental/messages/version.es.json`, `apps/dental/messages/version.en.json`
- `docs/devlog/INDEX.md`, `tasks/active.md`, `tasks/backlog.md`

## Antes vs Después

Medido en local reproduciendo el fallo. El NXDOMAIN real no sirve como reproducción
porque el resolver local responde en 33 ms, mientras que en Vercel tarda segundos por
intento. Se sustituyó por un servidor TCP que acepta la conexión y nunca responde, que
es lo que el middleware ve en ambos casos: una llamada que no vuelve.

| Escenario, Supabase caído | Antes | Después |
|---|---|---|
| Cookie de sesión de Supabase | más de 120 s, curl abortó (504 en Vercel) | 307 en 2.5 s |
| Cookie de sesión de Convex | no aplicaba | 200 en 25 ms, sin tocar Supabase |
| Sin cookies | rápido | 307 en 4 ms |

## Cómo probar

1. Levantar un servidor TCP que acepte y no conteste en `127.0.0.1:9099`.
2. Arrancar la app apuntando ahí, sin tocar `.env.local`:

```bash
AUTH_BACKEND=dual NEXT_PUBLIC_AUTH_BACKEND=dual \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9099 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fake-anon-key \
CONVEX_AUTH_SESSION_SECRET=<secreto de prueba> \
npm run dev:dental
```

3. Pedir `/` con una cookie `sb-127-auth-token` válida (formato de `@supabase/ssr`
   v0.6: prefijo literal `base64-` seguido del JSON de sesión en base64**url**, no
   base64 estándar). Debe responder 307 en unos 2.5 s, nunca colgarse.
4. Pedir `/` con una cookie `laralis_convex_session` firmada con ese mismo secreto.
   Debe responder 200 en milisegundos.

En producción, tras el deploy: recargar con Ctrl+Shift+R y comprobar que el badge de la
esquina inferior izquierda del sidebar marca `v0.7.1`.

## Riesgos y rollback

- **Riesgo bajo, acotado a la rama supabase del middleware.** La rama convex no se
  tocó, y con Supabase sano el comportamiento observable es el mismo salvo que una
  respuesta que tarde más de 2.5 s se ignora. Ese umbral está muy por encima de la
  latencia normal de `getUser()`.
- **Cambio real de comportamiento:** un usuario con sesión de Convex válida ya no
  refresca su cookie de Supabase desde el middleware. Con Supabase caído es irrelevante,
  y si vuelve a estar vivo el cliente y las páginas de servidor la refrescan igual.
- **Rollback:** revertir el commit. Devuelve el 504 mientras Supabase siga caído.

## Estado pendiente y decisiones abiertas

- Falta confirmar si el proyecto de Supabase está **pausado** (restaurable con un clic
  desde el dashboard) o **eliminado**. Si está eliminado, lo único perdido es
  `auth.users`, y el bridge de Convex queda como única puerta de entrada.
- El login en modo `dual` sigue intentando Supabase primero y solo cae al bridge de
  Convex cuando falla, así que arrastra el retraso del intento fallido. Invertir el
  orden en modo `dual` es un cambio de comportamiento de autenticación y queda
  pendiente de decisión.
- Registro, recuperación de contraseña, borrado de cuenta y export/import siguen
  apoyados en Supabase. Ver TASK-20260728-supabase-raw-clients.

## Siguientes pasos

- TASK-20260731-supabase-project-status: confirmar el estado del proyecto y decidir
  entre restaurarlo o cerrar el cutover de autenticación a Convex.
- TASK-20260731-middleware-timeout-test: cubrir con un test automatizado el caso
  "backend de auth no responde", que hoy solo está verificado a mano.
- TASK-20260728-data-backend-fail-fast: sigue vigente y es de la misma familia. Un
  backend mal configurado o muerto debería fallar de forma ruidosa al arrancar, no
  degradar en silencio.
