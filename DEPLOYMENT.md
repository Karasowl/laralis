# Guía de Deployment - Laralis en Vercel

## Configuración Requerida

Este proyecto está configurado como un **monorepo** donde el código de Next.js está en la carpeta `web/`.

### 1. Variables de Entorno (CRÍTICO)

Configura estas variables en Vercel Dashboard → Settings → Environment Variables:

```bash
# Supabase (REQUERIDO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# App Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app

# Security (REQUERIDO para MFA)
TOTP_ENCRYPTION_KEY=genera_un_secreto_aleatorio_de_64_caracteres

# Optional: Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=tu_upstash_url
UPSTASH_REDIS_REST_TOKEN=tu_upstash_token
```

#### Cómo generar TOTP_ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configuración del Proyecto en Vercel

#### Opción A: Deploy desde el Dashboard

1. Importa tu repositorio Git
2. **Framework Preset**: Next.js
3. **Root Directory**: Dejar en blanco (el vercel.json maneja esto)
4. **Build Command**: Automático (usa vercel.json)
5. **Output Directory**: Automático (usa vercel.json)
6. **Install Command**: Automático (usa vercel.json)

#### Opción B: Deploy desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy a producción
vercel --prod
```

### 3. Estructura del Proyecto

```
laralis/
├── web/                  # Aplicación Next.js
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .next/           # Build output
├── supabase/            # Migraciones DB
├── vercel.json          # Configuración Vercel (monorepo)
└── .vercelignore        # Archivos excluidos del deploy
```

### 4. Troubleshooting

#### Error: "An unexpected error happened"

**Causas comunes:**
- Variables de entorno faltantes
- Configuración de monorepo incorrecta
- Build fallando por errores de TypeScript

**Solución:**
1. Verifica que el `vercel.json` existe en la raíz
2. Confirma que las variables de entorno están configuradas
3. Revisa los logs completos en Vercel Dashboard

#### Error: "Module not found"

**Solución:**
```bash
# Limpiar y reconstruir localmente
cd web
rm -rf .next node_modules
npm install
npm run build
```

#### Error: Build timeout

**Solución:**
- Vercel Free tier tiene límite de 45 minutos
- Nuestro build típico toma ~3-5 minutos
- Si falla, contacta soporte de Vercel

### 5. Checklist Pre-Deployment

- [ ] Build local exitoso (`cd web && npm run build`)
- [ ] Variables de entorno configuradas en Vercel
- [ ] Migraciones de Supabase aplicadas
- [ ] `vercel.json` y `.vercelignore` en la raíz del repo
- [ ] Tests pasando (`npm run test:quick`)

### 6. Post-Deployment

1. **Verificar funcionalidad básica:**
   - Login/Registro
   - Creación de workspace
   - Navegación entre módulos

2. **Verificar integraciones:**
   - Supabase conectado correctamente
   - RLS funcionando
   - API routes respondiendo

3. **Monitoreo:**
   - Revisa Analytics en Vercel Dashboard
   - Configura alertas de errores (opcional: Sentry)

### 7. Rollback

Si algo falla en producción:

```bash
# Desde CLI
vercel rollback

# O desde Dashboard
Deployments → [deployment anterior] → Promote to Production
```

### 8. Dominios Personalizados

1. Ve a Settings → Domains en Vercel
2. Agrega tu dominio
3. Configura DNS según instrucciones
4. Actualiza `NEXT_PUBLIC_APP_URL` en variables de entorno

---

## Comandos Útiles

```bash
# Build local (debe pasar antes de deployar)
cd web && npm run build

# Verificar tipos
cd web && npm run typecheck

# Tests rápidos
cd web && npm run test:quick

# Limpiar build
cd web && rm -rf .next

# Ver logs de Vercel
vercel logs [deployment-url]
```

## Soporte

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Supabase**: https://supabase.com/docs

---

**Última actualización**: 2025-10-20
