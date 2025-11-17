import type { GuardContext } from './index';

// Namespaced event helper with idempotency key
function emitOnce(name: string, detail: any): void {
  try {
    const key = `${name}:${detail?.clinicId || ''}:${detail?.serviceId || ''}`;
    const now = Date.now();
    (window as any).__laralisAutofix = (window as any).__laralisAutofix || { last: new Map<string, number>() };
    const lastMap: Map<string, number> = (window as any).__laralisAutofix.last;
    const last = lastMap.get(key) || 0;
    // throttle 2s to avoid double-open on rapid submits/HMR
    if (now - last < 2000) return;
    lastMap.set(key, now);
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

// Open CSV/Sheet importer for supplies
export async function openBulkImportSupplies(ctx: GuardContext): Promise<boolean> {
  const detail = { clinicId: ctx.clinicId };
  emitOnce('onboarding:open-supplies-importer', detail);
  // Back-compat
  emitOnce('open-supplies-importer', detail);
  return false;
}

// Open quick wizard to create minimal recipe for a service
export async function openQuickRecipeWizard(ctx: GuardContext): Promise<boolean> {
  const detail = { clinicId: ctx.clinicId, serviceId: ctx.serviceId };
  emitOnce('onboarding:open-recipe-wizard', detail);
  emitOnce('open-recipe-wizard', detail);
  return false;
}
