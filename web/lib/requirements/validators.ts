// Client-side validators using existing API routes
import type { GuardContext } from './index';

// Simple TTL cache to avoid spinner loops on repeated checks across pages
const cache = new Map<string, { t: number; v: any }>();
const TTL_MS = 30_000; // 30s default
const FETCH_TIMEOUT_MS = 5000; // 5s timeout per validator

function key(url: string) { return url; }

function getClinicIdCookie(): string | undefined {
  try {
    if (typeof document === 'undefined') return undefined;
    const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

function getClinicIdStorage(): string | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    const v = window.localStorage?.getItem('selectedClinicId');
    return v || undefined;
  } catch {
    return undefined;
  }
}

function buildUrl(path: string, clinicId?: string, params?: Record<string, string | number | undefined>) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const u = new URL(path, base);
  // Prefer explicit clinicId, then cookie, then localStorage fallback
  const cid = clinicId || getClinicIdCookie() || getClinicIdStorage();
  if (cid) u.searchParams.set('clinicId', cid);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    }
  }
  return u.pathname + (u.search ? u.search : '');
}

async function apiGet<T = any>(url: string): Promise<T | null> {
  const k = key(url);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && now - hit.t < TTL_MS) return hit.v as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { credentials: 'include', signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    cache.set(k, { t: now, v: json });
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function hasMonthlyDepreciation(ctx: GuardContext): Promise<boolean> {
  const url = buildUrl('/api/assets/summary', ctx.clinicId);
  const js = await apiGet<{ data?: { monthly_depreciation_cents?: number } }>(url);
  const v = Number(js?.data?.monthly_depreciation_cents || 0);
  return v > 0;
}

export async function hasFixedCosts(ctx: GuardContext): Promise<boolean> {
  // Only consider explicit fixed-cost rows here. Depreciation has its own step.
  const fixed = await apiGet<{ data?: Array<{ amount_cents: number }> }>(buildUrl('/api/fixed-costs', ctx.clinicId, { limit: 200 }));
  const fixedSum = (fixed?.data || []).reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
  return fixedSum > 0;
}

export async function hasCostPerMinute(ctx: GuardContext): Promise<boolean> {
  // Require time settings and positive total fixed costs to derive CPM > 0
  const time = await apiGet<{ data?: { work_days?: number; hours_per_day?: number; real_pct?: number; fixed_per_minute_cents?: number } }>(buildUrl('/api/settings/time', ctx.clinicId));
  const fixed = await apiGet<{ data?: Array<{ amount_cents: number }> }>(buildUrl('/api/fixed-costs', ctx.clinicId, { limit: 200 }));
  const assets = await apiGet<{ data?: { monthly_depreciation_cents?: number } }>(buildUrl('/api/assets/summary', ctx.clinicId));

  const workDays = Number(time?.data?.work_days || 0);
  const hoursPerDay = Number(time?.data?.hours_per_day || 0);
  const realPctDec = Number(time?.data?.real_pct || 0);
  // Some endpoints return real_pct as decimal; normalize to decimal [0,1]
  const realPct = realPctDec > 1 ? realPctDec / 100 : realPctDec;

  const minutesMonth = workDays * hoursPerDay * 60;
  const effectiveMinutes = Math.round(minutesMonth * Math.max(0, Math.min(1, realPct)));

  const fixedSum = (fixed?.data || []).reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
  const dep = Number(assets?.data?.monthly_depreciation_cents || 0);
  const totalFixed = fixedSum + dep;

  // If API already calculates CPM, use it, else derive
  const cpm = Number(time?.data?.fixed_per_minute_cents || 0) || (effectiveMinutes > 0 && totalFixed > 0 ? Math.round(totalFixed / effectiveMinutes) : 0);
  return cpm > 0;
}

export async function hasBreakEven(ctx: GuardContext): Promise<boolean> {
  const js = await apiGet<{ data?: { break_even_revenue_cents?: number } }>(buildUrl('/api/equilibrium', ctx.clinicId));
  const bev = Number(js?.data?.break_even_revenue_cents || 0);
  return bev > 0;
}

export async function hasAnySupply(ctx: GuardContext): Promise<boolean> {
  const js = await apiGet<{ data?: Array<any> }>(buildUrl('/api/supplies', ctx.clinicId, { limit: 1 }));
  return (js?.data?.length || 0) > 0;
}

export async function hasAnyServiceRecipe(ctx: GuardContext): Promise<boolean> {
  // If a specific serviceId is provided, fetch services list (with embedded supplies)
  // and verify the target service has a non-empty recipe.
  if (ctx.serviceId) {
    const list = await apiGet<any[]>(buildUrl('/api/services', ctx.clinicId, { limit: 200 }));
    const svc = (list || []).find((s: any) => s?.id === ctx.serviceId);
    const recipe = Array.isArray(svc?.service_supplies) ? svc.service_supplies : [];
    return recipe.length > 0;
  }
  // Otherwise check if any service has recipe
  const list = await apiGet<any[]>(buildUrl('/api/services', ctx.clinicId, { limit: 50 }));
  const has = (list || []).some((s: any) => Array.isArray(s?.service_supplies) ? s.service_supplies.length > 0 : (Number(s?.variable_cost_cents) || 0) > 0);
  return has;
}

export async function hasAnyTariff(ctx: GuardContext): Promise<boolean> {
  // Consider tariffs "ready" only when both CPM and recipe are satisfied.
  // This makes the progress reflect prerequisites instead of just "having services".
  const cpmOk = await hasCostPerMinute(ctx);
  const recipeOk = await hasAnyServiceRecipe(ctx);
  if (!cpmOk || !recipeOk) return false;

  // If a specific service is provided, ensure its computed total cost is non-zero.
  if (ctx.serviceId) {
    const js = await apiGet<{ data?: { total_cost_cents?: number } }>(`/api/services/${ctx.serviceId}/cost`);
    return Number(js?.data?.total_cost_cents || 0) > 0;
  }

  // Otherwise, at least one service must exist to adjust tariffs.
  const list = await apiGet<any[]>(buildUrl('/api/services', ctx.clinicId, { limit: 1 }));
  return (list || []).length > 0;
}
