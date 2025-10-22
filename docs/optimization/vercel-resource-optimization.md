# Optimización de Recursos en Vercel - Laralis

**Fecha**: 2025-10-20
**Prioridad**: P1 - Alta
**Objetivo**: Reducir costos y evitar límites de Edge Requests/Function Invocations en Vercel

---

## Contexto

Vercel cobra por diferentes métricas en el plan Pro:
- **Edge Requests**: Cada request que pasa por middleware o Edge Functions
- **Function Invocations**: Llamadas a Serverless Functions
- **Image Optimization**: Procesamiento de imágenes con next/image
- **Build Time**: Tiempo de compilación y revalidaciones ISR

Con solo 100-200 visitas diarias, puedes alcanzar **millones de Edge Requests** si no optimizas correctamente, especialmente con:
- Middleware ejecutándose en cada request
- Prefetch automático de Next.js en todos los links
- Revalidaciones ISR innecesarias
- Optimización de imágenes en cada render

---

## Tareas de Optimización

### 1. ✅ Evitar Edge Functions y Middleware Innecesarios

**Prioridad**: P0 - Crítico
**Impacto**: Alto - Puede reducir 90% de Edge Requests

#### Estado Actual
- ✅ Ya NO usamos `middleware.ts` en el proyecto
- ✅ Ya NO usamos `runtime: 'edge'` en las API routes
- ✅ Todas las rutas usan Serverless Functions (Node.js runtime)

#### Acción
```typescript
// ❌ EVITAR - No agregar esto:
// middleware.ts
export const config = {
  matcher: '/:path*',
}

// ❌ EVITAR - No agregar esto en route.ts:
export const runtime = 'edge'
```

#### Verificación
```bash
# Buscar uso de edge runtime
grep -r "runtime.*edge" web/app/api/

# Buscar middleware.ts
find web -name "middleware.ts"

# Resultado esperado: Sin resultados
```

**Estado**: ✅ Ya cumplido - No requiere acción

---

### 2. ⏳ Optimizar Prefetching de Next.js

**Prioridad**: P1 - Alta
**Impacto**: Medio-Alto - Reduce 50-70% de Edge Requests innecesarios

#### Problema
Next.js hace prefetch automático de TODOS los links visibles en viewport, lo que genera requests innecesarios.

#### Solución A: Desactivar prefetch globalmente (Recomendado)

**Archivo**: `web/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... configuración existente

  experimental: {
    // Desactivar prefetch automático
    optimisticClientCache: false,
  },
}

module.exports = nextConfig
```

#### Solución B: Desactivar prefetch selectivamente

**Aplicar en componentes de navegación**:

```typescript
// web/components/layouts/AppLayout.tsx
// web/components/ui/sidebar.tsx

// ❌ ANTES - Prefetch automático
<Link href="/dashboard">Dashboard</Link>

// ✅ DESPUÉS - Sin prefetch innecesario
<Link href="/dashboard" prefetch={false}>
  Dashboard
</Link>

// ✅ Prefetch solo en links críticos
<Link href="/treatments" prefetch={true}>
  Tratamientos
</Link>
```

#### Implementar prefetch manual inteligente

```typescript
// web/hooks/use-smart-prefetch.ts
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function useSmartPrefetch(href: string, enabled = true) {
  const router = useRouter()
  const prefetched = useRef(false)

  useEffect(() => {
    if (!enabled || prefetched.current) return

    const timer = setTimeout(() => {
      router.prefetch(href)
      prefetched.current = true
    }, 2000) // Prefetch después de 2 segundos de hover/visible

    return () => clearTimeout(timer)
  }, [href, enabled, router])
}

// Uso:
function NavigationLink({ href, children }) {
  const [isHovered, setIsHovered] = useState(false)
  useSmartPrefetch(href, isHovered)

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => setIsHovered(true)}
    >
      {children}
    </Link>
  )
}
```

#### Archivos a modificar
- `web/components/layouts/AppLayout.tsx` - Links del sidebar
- `web/components/ui/sidebar.tsx` - Links de navegación
- `web/components/dashboard/*.tsx` - Links internos
- `web/app/*/page.tsx` - Todos los Links en páginas

**Estado**: ⏳ Pendiente

---

### 3. ⏳ Rate Limiting en API Endpoints

**Prioridad**: P1 - Alta
**Impacto**: Alto - Protege contra abuso y spikes de costos

#### Problema
Sin rate limiting, un bot o usuario malicioso puede generar millones de requests y agotar créditos.

#### Solución: Implementar Upstash Rate Limit

**Instalación**:
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Configuración**: `web/lib/rate-limit.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Crear instancia de Redis (usa variables de entorno)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limiter por IP - 10 requests por 10 segundos
export const rateLimiterIP = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "ratelimit:ip",
})

// Rate limiter por usuario - 100 requests por minuto
export const rateLimiterUser = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit:user",
})

// Rate limiter estricto para endpoints costosos - 5 req/min
export const rateLimiterStrict = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "ratelimit:strict",
})
```

**Uso en API Routes**:

```typescript
// web/app/api/dashboard/revenue/route.ts
import { rateLimiterIP, rateLimiterUser } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Rate limit por IP
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success, limit, remaining, reset } = await rateLimiterIP.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    )
  }

  // ... resto del código
}
```

**Aplicar rate limiting en**:
- ✅ `/api/dashboard/*` - Rate limiter normal (10 req/10s por IP)
- ✅ `/api/analytics/*` - Rate limiter strict (5 req/min por IP)
- ✅ `/api/reports/*` - Rate limiter strict
- ✅ Endpoints de creación/edición - Rate limiter user (100 req/min por usuario)

**Variables de entorno** (`.env.local`):
```bash
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

**Estado**: ⏳ Pendiente

---

### 4. ⏳ Monitoreo y Alertas Tempranas

**Prioridad**: P2 - Media
**Impacto**: Medio - Prevención de sorpresas en facturación

#### Solución A: Webhook de Vercel

**Configuración**:
1. Ir a Vercel Dashboard → Settings → Integrations
2. Configurar webhook para eventos de uso
3. Crear endpoint `/api/webhooks/vercel-usage`

```typescript
// web/app/api/webhooks/vercel-usage/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Verificar firma del webhook
  const signature = request.headers.get('x-vercel-signature')
  // ... validación

  // Extraer métricas
  const { usage, limit } = body

  const percentageUsed = (usage / limit) * 100

  // Alerta cuando se usa 80% de créditos
  if (percentageUsed >= 80) {
    // Enviar email o notificación
    await sendAlertEmail({
      subject: '⚠️ Alerta: 80% de créditos Vercel usados',
      message: `Has usado ${percentageUsed.toFixed(1)}% de tus créditos mensuales.`,
      usage,
      limit,
    })
  }

  return NextResponse.json({ success: true })
}

async function sendAlertEmail(data: any) {
  // Implementar con Resend, SendGrid, etc.
  // O webhook a Slack/Discord
}
```

#### Solución B: Script de monitoreo manual

```typescript
// scripts/check-vercel-usage.ts
import { vercel } from '@vercel/client'

async function checkUsage() {
  const usage = await vercel.getTeamUsage({
    teamId: process.env.VERCEL_TEAM_ID!,
  })

  const edgeRequests = usage.edgeRequests
  const limit = 1000000 // 1M en plan Pro

  const percentage = (edgeRequests.current / limit) * 100

  if (percentage >= 80) {
    console.log('⚠️ ALERTA: Has usado', percentage.toFixed(1), '% de Edge Requests')
    // Enviar notificación
  }
}

checkUsage()
```

**Ejecutar con cron job** (GitHub Actions o Vercel Cron):
```yaml
# .github/workflows/check-usage.yml
name: Check Vercel Usage
on:
  schedule:
    - cron: '0 */6 * * *' # Cada 6 horas

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run check:usage
```

**Estado**: ⏳ Pendiente

---

### 5. ⏳ Desactivar Revalidación Innecesaria (ISR)

**Prioridad**: P1 - Alta
**Impacto**: Medio - Reduce Function Invocations y Build Time

#### Problema
Revalidaciones ISR innecesarias pueden generar rebuilds constantes y funciones serverless.

#### Solución: Estrategia de Caché

**Para páginas estáticas** (Landing, docs):
```typescript
// web/app/page.tsx (homepage)
export const revalidate = false // Nunca revalidar - contenido estático

// O si necesita actualización ocasional:
export const revalidate = 86400 // 24 horas
```

**Para páginas dinámicas del dashboard**:
```typescript
// web/app/dashboard/page.tsx
// NO usar ISR - usar CSR (Client Side Rendering)
// Ya está implementado correctamente con 'use client'

// ✅ Correcto - Fetch en cliente
export default function DashboardPage() {
  const { data } = useDashboard() // Hook de cliente
  // ...
}
```

**Para API routes - Usar caché manual**:
```typescript
// web/app/api/dashboard/revenue/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Cache simple en memoria (para datos que cambian poco)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export async function GET(request: NextRequest) {
  const clinicId = request.nextUrl.searchParams.get('clinicId')
  const cacheKey = `revenue:${clinicId}`

  // Verificar cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'private, max-age=300', // 5 min en navegador
      }
    })
  }

  // Fetch datos...
  const data = await fetchRevenueData(clinicId)

  // Guardar en cache
  cache.set(cacheKey, { data, timestamp: Date.now() })

  return NextResponse.json(data, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': 'private, max-age=300',
    }
  })
}
```

#### Archivos a revisar
- `web/app/**/page.tsx` - Verificar uso de `revalidate`
- `web/app/api/**/*.ts` - Implementar caché donde aplique

**Estado**: ⏳ Pendiente

---

### 6. ⏳ Optimización de Imágenes

**Prioridad**: P2 - Media
**Impacto**: Bajo-Medio - Reduce Image Optimization costs

#### Problema Actual
Laralis es una app dental B2B, NO tiene muchas imágenes públicas. Bajo riesgo.

#### Buenas Prácticas

**A. Usar imágenes estáticas locales**:
```typescript
// ❌ EVITAR - Optimizar en cada request
<Image src="https://external-site.com/image.jpg" width={500} height={300} />

// ✅ MEJOR - Imagen local (optimizada en build)
import logoImg from '@/public/logo.png'
<Image src={logoImg} alt="Logo" />
```

**B. Desactivar optimización para imágenes pequeñas**:
```typescript
// next.config.js
module.exports = {
  images: {
    // Solo optimizar imágenes > 10KB
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200], // Reducir breakpoints
    imageSizes: [16, 32, 48, 64, 96], // Reducir tamaños

    // Desactivar optimización para dominios confiables
    unoptimized: false,

    // Limitar formatos
    formats: ['image/webp'], // Solo WebP, no AVIF
  },
}
```

**C. Lazy loading agresivo**:
```typescript
// Todas las imágenes con loading lazy
<Image
  src="/avatar.png"
  loading="lazy"
  placeholder="blur" // Solo si tienes blurDataURL
/>
```

**D. Considerar CDN externo** (si crece el uso):
- Cloudinary (free tier)
- ImageKit (free tier)
- Self-hosted con Sharp

**Estado**: ⏳ Pendiente (Baja prioridad - pocas imágenes en app)

---

## Plan de Implementación

### Sprint 1 - Optimizaciones Críticas (1-2 días)
1. ✅ Verificar que NO usamos edge runtime (Ya hecho)
2. ⏳ Desactivar prefetch automático global
3. ⏳ Agregar `prefetch={false}` a todos los Links
4. ⏳ Implementar rate limiting en API routes críticas

### Sprint 2 - Monitoreo (1 día)
5. ⏳ Configurar Upstash Redis para rate limiting
6. ⏳ Crear script de monitoreo de uso
7. ⏳ Configurar alertas por email/Slack

### Sprint 3 - Caché y Performance (1-2 días)
8. ⏳ Implementar caché en API routes de dashboard
9. ⏳ Revisar y optimizar `revalidate` en páginas
10. ⏳ Optimizar configuración de next/image

---

## Checklist de Verificación

Antes de deployar a producción:

- [ ] NO existe archivo `middleware.ts`
- [ ] NO hay `runtime: 'edge'` en ningún `route.ts`
- [ ] Todos los `<Link>` críticos tienen `prefetch={false}`
- [ ] Rate limiting implementado en `/api/dashboard/*`
- [ ] Rate limiting implementado en `/api/analytics/*`
- [ ] Script de monitoreo de uso configurado
- [ ] Alertas configuradas (80% de créditos)
- [ ] Caché implementado en endpoints frecuentes
- [ ] `revalidate` configurado correctamente
- [ ] Imágenes usando lazy loading

---

## Métricas Esperadas

### Antes de Optimización (Estimado)
- Edge Requests: ~500K/mes con 200 visitas/día
- Function Invocations: ~100K/mes
- Image Optimizations: ~10K/mes

### Después de Optimización (Meta)
- Edge Requests: < 50K/mes (90% reducción)
- Function Invocations: < 30K/mes (70% reducción)
- Image Optimizations: < 5K/mes (50% reducción)

**Ahorro estimado**: $20-40 USD/mes en plan Pro

---

## Recursos y Referencias

### Documentación Oficial
- [Vercel Pricing](https://vercel.com/pricing)
- [Next.js Prefetching](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating#prefetching)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)

### Herramientas
- [Upstash Console](https://console.upstash.com/) - Redis para rate limiting
- [Vercel Analytics](https://vercel.com/analytics) - Monitoreo de uso
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) - Analizar tamaño

---

## Cómo Retomar Esta Tarea

**Opción corta**:
```
Optimización Vercel - ver docs/optimization/vercel-resource-optimization.md
```

**Opción con contexto**:
```
Implementar optimizaciones de Vercel para reducir Edge Requests.
Ver checklist en docs/optimization/vercel-resource-optimization.md
```

**Para empezar**:
```
Empezar Sprint 1 de optimizaciones Vercel - empezando por desactivar prefetch.
Ver plan en docs/optimization/vercel-resource-optimization.md
```

---

**Última actualización**: 2025-10-20
**Estado**: Documento completo - Listo para implementación
