# Reconstruir el entorno en otra PC (continuar el trabajo)

> Guía para clonar el repo en una máquina nueva y dejar el proyecto corriendo
> **exactamente** como aquí. Lo único que NO viaja por git son los archivos de
> secretos (`.env*.local`, `cypress.env.json`) — todo lo demás está en el repo.
>
> Rama de trabajo actual: **`fix/dashboard-patients-seen-vs-new`**

---

## TL;DR (lo mínimo para arrancar)

```bash
# 1. Clonar y entrar
git clone https://github.com/Karasowl/laralis.git
cd laralis

# 2. Cambiar a la rama de trabajo
git checkout fix/dashboard-patients-seen-vs-new
git pull

# 3. Instalar dependencias (monorepo: instala apps/dental también)
npm install

# 4. Recuperar los secretos (elige UNA de las dos vías de la sección 4)
#    Vía A (recomendada): vercel env pull
#    Vía B: copiar los .env*.local manualmente desde la otra PC

# 5. Levantar el dev server
npm run dev:dental          # http://localhost:3000
```

---

## 1) Requisitos de la máquina

| Herramienta | Versión sugerida | Notas |
|-------------|------------------|-------|
| **Node.js** | 20 LTS (mín. 18.18) | Next.js 14 + Convex 1.39 |
| **npm**     | 10+ (viene con Node 20) | El repo usa **npm workspaces** (no pnpm/yarn) |
| **Git**     | cualquiera reciente | |
| **Vercel CLI** | última (`npm i -g vercel`) | Solo si usas la Vía A para los secretos |

> No hay `.nvmrc`; si usas nvm, instala Node 20: `nvm install 20 && nvm use 20`.

---

## 2) Estructura del proyecto (lo que SÍ está en git)

- **Monorepo** con npm workspaces. Raíz = `laralis-suite`.
- App principal: **`apps/dental`** (`@laralis/dental`) — Next.js 14 App Router.
- **`apps/dental/convex/`** — backend de datos (Convex), versionado. Es la
  **fuente de verdad** actual (el proyecto ya migró las lecturas/escrituras a Convex).
- `supabase/` — migraciones SQL (legacy + auth dual + tests).
- `packages/` — paquetes compartidos (por ahora vacío).
- Scripts de workspace desde la raíz: `npm run dev:dental`, `build:dental`,
  `typecheck:dental`, `test:dental`.

---

## 3) Instalación

```bash
npm install            # desde la raíz; instala todos los workspaces
```

Esto crea `node_modules/` en la raíz y en `apps/dental/`. No necesitas
`cd apps/dental && npm install` por separado.

---

## 4) Secretos / variables de entorno  ← EL PASO QUE FALTA TRAS CLONAR

Los siguientes archivos están en `.gitignore` y **no se clonan**:

```
apps/dental/.env.local              # DEV: Convex + auth + flags de backend  ← imprescindible
apps/dental/.env.production.local   # secretos de prod (Supabase, AI, Twilio, Google, Resend, VAPID, CRON)
apps/dental/.env.qa.local           # tests E2E contra staging
apps/dental/cypress.env.json        # usuario de prueba para Cypress
```

Hay dos formas de recuperarlos. **Para continuar idéntico, la más fiel es la Vía B**
(copiar los archivos tal cual). La Vía A es la más cómoda si el proyecto en Vercel
tiene todas las variables al día.

### Vía A — `vercel env pull` (cómoda)

El repo ya está vinculado al proyecto Vercel `laralis`. En la PC nueva:

```bash
vercel login
cd laralis
vercel link            # confirma org/proyecto: team … / laralis
# Trae las variables de cada entorno a su archivo:
vercel env pull apps/dental/.env.local            --environment=development
vercel env pull apps/dental/.env.production.local --environment=production
```

> Revisa que `.env.local` quede con las variables de **Convex** y los flags
> `AUTH_BACKEND=convex`, `DATA_READ_BACKEND=convex`, `DATA_WRITE_MODE=convex`.
> Si Vercel no las tuviera, complétalas a mano usando `apps/dental/.env.example`
> como referencia (sección "1) Convex").

### Vía B — copiar los archivos manualmente (idéntico, recomendado)

Desde la PC actual, copia estos 4 archivos a la PC nueva por un canal seguro
(USB cifrado, gestor de contraseñas, etc. — **nunca** por git ni chat público):

```
apps/dental/.env.local
apps/dental/.env.production.local
apps/dental/.env.qa.local        (solo si vas a correr tests E2E/QA)
apps/dental/cypress.env.json     (solo si vas a correr Cypress)
```

Pégalo en la misma ruta dentro del repo clonado. Listo: entorno idéntico.

### Vía C — desde cero (sin acceso a la otra PC ni a Vercel)

```bash
cp apps/dental/.env.example apps/dental/.env.local
```

y rellena al menos la **sección 1 (Convex)** del archivo. Con eso arranca el dev
server. Las integraciones (IA, WhatsApp, email, Google, push) requieren sus
propias claves; mientras falten, esas features quedan inactivas pero la app corre.

---

## 5) Convex (backend de datos)

- Las variables `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` apuntan a un
  deployment **en la nube ya existente**. Copiándolas, la PC nueva se conecta al
  **mismo** backend — **no** hay que re-deployar ni re-seedear Convex.
- El código de Convex (`apps/dental/convex/`) y su codegen (`_generated/`) ya
  están en el repo.
- Solo si vas a **editar funciones de Convex** y quieres el watcher/codegen local:
  ```bash
  cd apps/dental
  npx convex dev          # observa cambios y regenera _generated
  ```
  (Para cutover de Convex Auth ver `apps/dental/docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`.)

---

## 6) Arrancar y verificar

```bash
# Dev server (desde la raíz)
npm run dev:dental                 # http://localhost:3000

# Verificaciones rápidas
npm run typecheck:dental           # TypeScript
npm run test:dental                # unit/integración (Vitest)
```

> El puerto por defecto es **3000**. Si ya lo tienes ocupado, libera ese puerto
> en vez de levantar otro (el dev script ya intenta matar procesos Next viejos).

Usuario de prueba (login en la app, está en `cypress.env.json`):
`ismaelguimarais@gmail.com` / `test123456`.

---

## 7) Checklist al llegar a la PC nueva

- [ ] `node -v` → 20.x (o ≥ 18.18)
- [ ] `git checkout fix/dashboard-patients-seen-vs-new` y `git pull`
- [ ] `npm install` sin errores
- [ ] `apps/dental/.env.local` presente con las vars de **Convex** + flags `*_BACKEND=convex`
- [ ] (opcional) `.env.production.local`, `.env.qa.local`, `cypress.env.json` copiados
- [ ] `npm run dev:dental` levanta en `http://localhost:3000`
- [ ] Login OK con el usuario de prueba
- [ ] `npm run typecheck:dental` en verde

---

## 8) Notas

- **No** subas nunca los `.env*.local` ni `cypress.env.json` al repo (ya están
  ignorados; mantenlo así).
- Si agregas una variable de entorno nueva, **actualiza también
  `apps/dental/.env.example`** para que la próxima PC sepa que existe.
- La plantilla completa con todas las variables y comentarios está en
  **`apps/dental/.env.example`**.
