'use client';
import { useState, useCallback } from 'react';
import type { ActionId, GuardContext } from './index';
import { evaluateRequirements, getAction, tryAutofix } from './index';
import { track } from '@/lib/analytics';

type CtxProvider = () => GuardContext;

export function useRequirementsGuard(ctxProvider: CtxProvider) {
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const ensureReady = useCallback(async (actionId: ActionId, extra?: Partial<GuardContext>) => {
    setChecking(true);
    try {
      const base = ctxProvider();
      const ctx: GuardContext = { ...base, ...extra } as GuardContext;
      const action = getAction(actionId);
      const result = await evaluateRequirements(ctx, action.minRequirements as any);
      setMissing(result.missing);
      track({ event: 'guard.open', actionId, clinicId: ctx.clinicId, serviceId: ctx.serviceId, missing: result.missing });

      if (result.missing.length === 0) return { allowed: true, missing: [] as string[] };

      // Fire non-invasive autofixers (open drawers/wizards/importers)
      const executed = await tryAutofix(ctx, result.missing as any);
      if (executed.length > 0) {
        track({ event: 'autofix.triggered', actionId, clinicId: ctx.clinicId, serviceId: ctx.serviceId, missing: executed });
      }
      const after = await evaluateRequirements(ctx, action.minRequirements as any);
      setMissing(after.missing);

      if (after.missing.length === 0) {
        track({ event: 'unblocked', actionId, clinicId: ctx.clinicId, serviceId: ctx.serviceId });
        return { allowed: true, missing: [] as string[] };
      }
      return { allowed: false, missing: after.missing };
    } finally {
      setChecking(false);
    }
  }, [ctxProvider]);

  return { ensureReady, checking, missing };
}
